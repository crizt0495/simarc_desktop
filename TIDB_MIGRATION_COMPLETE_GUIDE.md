# SIMARC Desktop: TiDB Cloud Migration - COMPLETE EXECUTION GUIDE

> **⚠️ CRITICAL**: This migration CANNOT be executed from the current development environment (DNS resolution fails for `gateway01.ap-northeast-1.prod.aws.tidibcloud.com`).  
> **You MUST run these steps from a machine with internet access to AWS ap-northeast-1 region.**

---

## ✅ PRE-MIGRATION CHECKLIST (Already Done)

- [x] `.env` configured with TiDB Cloud credentials
- [x] `simarc.sql` backup ready (135MB, complete structure + data)
- [x] Application builds ready (.deb, Windows EXE)
- [x] Local MariaDB working 100% (fallback)
- [x] Migration plan documented in `MIGRATION_PLAN.md`

---

## 📋 PHASE 1: TiDB Cloud Console Setup (5-10 menit)

### 1.1 Login ke TiDB Cloud
```bash
# Buka browser, akses:
https://zap.tidbcloud.com
```
- Login dengan akun TiDB Cloud Anda
- Pilih project/cluster yang sudah ada

### 1.2 Buat Database `simarc`
```sql
-- Di TiDB Cloud SQL Editor (Console > SQL Editor):
CREATE DATABASE IF NOT EXISTS `simarc` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;
```

### 1.3 Catat Connection Details
Dari Console > Connection Info, catat:
- **Host**: `gateway01.ap-northeast-1.prod.aws.tidibcloud.com` (atau yang baru)
- **Port**: `4000`
- **Username**: `419auXgnyEgUPJS.root` (atau yang baru)
- **Password**: `6QK6gILapucgLcGI` (atau yang baru)
- **TLS**: `skip-verify` (required for TiDB Cloud)

---

## 📋 PHASE 2: Import Database (10-30 menit tergantung bandwidth)

### 2.1 Option A: Import via TiDB Cloud Console (Recommended)
1. Buka Console > **Import Data**
2. Pilih **SQL File**
3. Upload `simarc.sql` (135MB - may need to split if too large)
4. Pilih database `simarc`
5. Klik **Start Import**
6. Tunggu sampai selesai (monitor progress)

### 2.2 Option B: Import via Command Line (jika file terlalu besar)
```bash
# Split file jika > 100MB
split -l 50000 simarc.sql simarc_part_

# Import per part
for f in simarc_part_*; do
  mysql -h gateway01.ap-northeast-1.prod.aws.tidibcloud.com \
        -P 4000 \
        -u 419auXgnyEgUPJS.root \
        -p6QK6gILapucgLcGI \
        --ssl-mode=VERIFY_IDENTITY \
        simarc < "$f"
done
```

### 2.3 Option C: Import via MySQL Workbench / DBeaver
1. Connect ke TiDB Cloud
2. File > Run SQL Script > Pilih `simarc.sql`
3. Execute

---

## 📋 PHASE 3: Validate Import (5 menit)

### 3.1 Verify Tables Created
```sql
-- Di TiDB Cloud SQL Editor:
USE simarc;
SHOW TABLES;
```

Expected: 20+ tables including:
- `users`, `roles`, `permissions`, `permission_role`
- `arsip`, `unit_kerja`, `jenis_arsip`, `kode_klasifikasi`
- `lokasi_arsip`, `pemberkasan`, `peminjaman_arsip`
- `pemusnahan_arsip`, `activity_logs`, `migrations`, etc.

### 3.2 Verify Record Counts
```sql
SELECT 
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM roles) as roles,
  (SELECT COUNT(*) FROM arsip) as arsip,
  (SELECT COUNT(*) FROM activity_logs) as activity_logs,
  (SELECT COUNT(*) FROM unit_kerja) as unit_kerja,
  (SELECT COUNT(*) FROM lokasi_arsip) as lokasi_arsip;
```

Expected minimum:
- `users`: ≥ 1 (admin)
- `roles`: ≥ 7 (Admin, Petugas, Arsiparis, Pimpinan, Staff, Viewer, User)
- `arsip`: ≥ 250
- `activity_logs`: ≥ 250
- `unit_kerja`: ≥ 1
- `lokasi_arsip`: ≥ 1 (Record Center - Rak A)

### 3.3 Verify Admin User
```sql
SELECT id, username, name, is_active, role_id 
FROM users 
WHERE username = 'admin';
```
Should return: admin user with `is_active = 1`

---

## 📋 PHASE 4: Test Connection from Target Machine (5 menit)

**Run this on the machine where SIMARC will be installed:**

```bash
# Test basic connectivity
mysql -h gateway01.ap-northeast-1.prod.aws.tidibcloud.com \
      -P 4000 \
      -u 419auXgnyEgUPJS.root \
      -p6QK6gILapucgLcGI \
      --ssl-mode=VERIFY_IDENTITY \
      simarc -e "SELECT VERSION();"

# Test application query
mysql -h gateway01.ap-northeast-1.prod.aws.tidibcloud.com \
      -P 4000 \
      -u 419auXgnyEgUPJS.root \
      -p6QK6gILapucgLcGI \
      --ssl-mode=VERIFY_IDENTITY \
      simarc -e "SELECT COUNT(*) as total_arsip FROM arsip;"
```

**Expected output:**
```
+-------------------------+
| VERSION()               |
+-------------------------+
| 8.0.x-TiDB-v8.x.x       |
+-------------------------+

+--------------+
| total_arsip  |
+--------------+
| 250+         |
+--------------+
```

---

## 📋 PHASE 5: Switch Application to TiDB Cloud (2 menit)

### 5.1 Verify .env is Correct
File: `/path/to/simarc-desktop/.env`
```env
DB_HOST=gateway01.ap-northeast-1.prod.aws.tidibcloud.com
DB_PORT=4000
DB_DATABASE=simarc
DB_USERNAME=2rw8jJGWyKQhAwb.root
DB_PASSWORD=8r3K7EX1msCpStYN
DB_TLS=skip-verify
```

### 5.2 Restart Application
```bash
# Linux (systemd/service)
sudo systemctl restart simarc

# Atau manual
pkill -f simarc
./simarc &

# Windows (jika pakai installer)
# Restart via Task Manager atau Start Menu
```

### 5.3 Verify Application Startup Logs
Check for:
```
[simarc] DB ok
[simarc] Migrasi selesai
```
**NOT:**
```
[simarc] DB gagal: ...
[simarc] Migrasi gagal: ...
```

---

## 📋 PHASE 6: Complete Functional Testing (15-30 menit)

### 6.1 Test Login
- Buka aplikasi SIMARC
- Login: `username: admin` / `password: admin`
- Verify: Dashboard loads dengan stats real dari TiDB

### 6.2 Test 18 Modul Sidebar (ALL MUST WORK)
| Modul | Test Action | Expected |
|-------|-------------|----------|
| **Dashboard** | Load page | Stats show real counts from TiDB |
| **Arsip** | List, Create, Edit, Delete | CRUD works, 250+ records visible |
| **Peminjaman** | Create pinjaman | Form works, saves to TiDB |
| **Pemberkasan** | Create berkas | Form works, saves to TiDB |
| **Pemusnahan** | Create pengajuan | Form works, saves to TiDB |
| **Pengguna** | List users | Admin user visible |
| **Roles** | List roles | 7 roles visible |
| **Unit Kerja** | List units | Data visible |
| **Jenis Arsip** | List jenis | Data visible |
| **Kode Klasifikasi** | List kode | Data visible |
| **Lokasi Arsip** | List lokasi | "Record Center - Rak A" visible |
| **Retensi** | View expiring | Data loads |
| **Penyusutan** | View eligible | Data loads |
| **Activity Log** | View logs | 250+ logs visible |
| **Backup** | Create backup | Works (may need mysqldump) |
| **Settings** | View/Edit | Loads config |
| **Profile** | View profile | Admin profile shows |
| **Logout/Login** | Full cycle | Works correctly |

### 6.3 Test Critical Operations
```bash
# Test 1: Create new arsip via UI
# → Verify appears in list immediately

# Test 2: Edit existing arsip
# → Verify changes persist after refresh

# Test 3: Role-based access
# → Login as different role (if created)
# → Verify permissions work

# Test 4: File upload (if applicable)
# → Upload file to arsip
# → Verify file_path stored

# Test 5: Search/Filter
# → Search arsip by nomor/nama
# → Filter by unit, jenis, status
```

---

## 📋 PHASE 7: Performance & Stability Check (10 menit)

### 7.1 Monitor Connection Pool
```bash
# Check active connections in TiDB Cloud Console
# Should stay under pool limits (max 25 for desktop)
```

### 7.2 Test Concurrent Access
- Open multiple browser tabs
- Perform operations simultaneously
- Verify no "Too many connections" errors

### 7.3 Test Latency
```bash
# From target machine:
time mysql -h gateway01.ap-northeast-1.prod.aws.tidibcloud.com \
           -P 4000 -u 419auXgnyEgUPJS.root -p6QK6gILapucgLcGI \
           --ssl-mode=VERIFY_IDENTITY \
           simarc -e "SELECT 1;"
# Should complete in < 500ms typically
```

---

## 📋 PHASE 8: Finalize & Document (5 menit)

### 8.1 Update Documentation
- [ ] Update `README.md` with TiDB Cloud connection info
- [ ] Document any schema changes made during import
- [ ] Note any TiDB-specific configurations

### 8.2 Backup New State
```bash
# Create fresh backup from TiDB Cloud
mysqldump -h gateway01.ap-northeast-1.prod.aws.tidibcloud.com \
          -P 4000 \
          -u 419auXgnyEgUPJS.root \
          -p6QK6gILapucgLcGI \
          --ssl-mode=VERIFY_IDENTITY \
          --single-transaction \
          --routines \
          --triggers \
          simarc > simarc_tidb_backup_$(date +%Y%m%d).sql
```

### 8.3 Verify Rollback Still Works
```bash
# Temporarily switch .env back to local MariaDB
# Restart app
# Verify local DB still works
# Switch back to TiDB Cloud
# Restart app
# Verify TiDB Cloud works
```

---

## ✅ MIGRATION COMPLETE - SIGN OFF

| Phase | Status | Completed By | Date | Notes |
|-------|--------|--------------|------|-------|
| 1. TiDB Cloud Setup | ☐ | | | |
| 2. Import Database | ☐ | | | |
| 3. Validate Import | ☐ | | | |
| 4. Test Connection | ☐ | | | |
| 5. Switch Application | ☐ | | | |
| 6. Functional Testing | ☐ | | | |
| 7. Performance Check | ☐ | | | |
| 8. Finalize | ☐ | | | |

**Migration Lead:** ________________ **Date:** ________________

**All 18 modules verified working:** ☐ YES / ☐ NO (list failures)

**Rollback tested:** ☐ YES / ☐ NO

---

## 🚨 TROUBLESHOOTING QUICK REFERENCE

| Issue | Solution |
|-------|----------|
| `Access denied` | Verify username/password in TiDB Cloud Console |
| `SSL connection error` | Use `--ssl-mode=VERIFY_IDENTITY` or `skip-verify` |
| `Host unknown` | Check DNS/firewall; try IP directly if available |
| `Too many connections` | Increase pool size in `database.go` or restart app |
| `Import timeout` | Split SQL file; increase timeout |
| `App shows "DB gagal"` | Check `.env` matches TiDB Cloud credentials exactly |
| `Missing tables` | Re-run import; check for errors in import log |
| `Data mismatch` | Compare record counts local vs TiDB; re-import if needed |

---

## 📞 SUPPORT CONTACTS

- **TiDB Cloud Support**: https://tidbcloud.com/support
- **SIMARC Repository**: Check git history for schema changes
- **Local Fallback**: Always available - just switch `.env` back to local MariaDB

---

## 🎯 SUCCESS CRITERIA (ALL MUST BE ✅)

- [ ] TiDB Cloud database `simarc` exists and accessible
- [ ] All 20+ tables imported successfully
- [ ] All 250+ arsip records present
- [ ] Admin user can login (admin/admin)
- [ ] All 18 sidebar modules load data from TiDB
- [ ] CRUD operations work on all modules
- [ ] Role-based access control functional
- [ ] Activity logs recording to TiDB
- [ ] Application startup shows `[simarc] DB ok` and `[simarc] Migrasi selesai`
- [ ] Rollback to local MariaDB tested and working
- [ ] Performance acceptable (< 500ms query latency)
- [ ] Fresh backup created from TiDB Cloud

---

**📝 NOTE**: This guide must be executed from a machine with network access to `gateway01.ap-northeast-1.prod.aws.tidibcloud.com:4000`. The current development environment CANNOT complete this migration due to DNS/network restrictions.