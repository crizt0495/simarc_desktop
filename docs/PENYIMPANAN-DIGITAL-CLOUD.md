# Penyimpanan Berkas Digital di Cloud — SIMARC

Dokumen ini menjelaskan cara menyimpan **berkas digital arsip** (PDF/gambar)
di cloud, sehingga bisa dibuka dari komputer mana pun yang memakai
konfigurasi yang sama. Database tetap TiDB Cloud; yang dipindahkan hanya
berkas digitalnya.

> Ringkas: **bisa**. SIMARC mendukung object storage S3-compatible
> (Cloudflare R2, Backblaze B2, MinIO, AWS S3). Tanpa konfigurasi, berkas
> tetap disimpan lokal seperti sebelumnya (tidak ada yang rusak).

---

## 1. Mode penyimpanan

Variabel `DIGITAL_STORAGE` pada `.env`:

| Nilai | Arti |
|-------|------|
| `auto` (default) | Cloud bila kredensial S3 lengkap, lalu rclone, jika tidak lokal. |
| `local` | Selalu di disk perangkat (`~/.local/share/simarc/digital`). |
| `s3` | Wajib object storage S3-compatible. Jika kredensial belum lengkap, upload ditolak dengan pesan jelas. |
| `rclone` | Wajib remote rclone (Google Drive, OneDrive, Dropbox, dsb.). |

Saat cloud aktif, kolom `arsip.file_path` berisi referensi
`s3://<bucket>/<prefix>/digital/<id-arsip>/<nama-berkas>` (S3) atau
`rclone://<remote>/<folder>/<id-arsip>/<nama-berkas>` (rclone).

---

## 2. Opsi gratis yang didukung

### Google Drive via rclone (sudah dikonfigurasi di perangkat ini)

Komputer ini sudah memiliki rclone dengan remote `gdrive` yang aktif
(kuota Drive Anda). SIMARC memakai remote tersebut, sehingga **tidak perlu
akun atau biaya baru**.

`.env` / `~/.env`:

```env
DIGITAL_STORAGE=rclone
DIGITAL_RCLONE_REMOTE=gdrive
DIGITAL_RCLONE_PATH=simarc-digital
```

Berkas akan tersimpan di `gdrive:simarc-digital/<id-arsip>/<nama-berkas>`.

Prasyarat di komputer lain: pasang `rclone`, lalu `rclone config` dan buat
remote dengan nama yang sama (`gdrive`) yang menunjuk ke akun Google Drive
yang sama. Tanpa itu, berkas cloud tidak bisa dibuka dari komputer tersebut.

### Cloudflare R2 (disarankan bila ingin tanpa rclone — gratis 10 GB, tanpa biaya egress)

1. Buat akun Cloudflare → **R2 Object Storage** → **Create bucket**
   (mis. `simarc-digital`).
2. Buka **Manage R2 API Tokens** → **Create API token** dengan izin
   **Object Read & Write** untuk bucket tersebut.
3. Catat:
   - Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - Access Key ID
   - Secret Access Key
4. Isi `.env` (jangan bagikan Secret Key ke publik):

```env
DIGITAL_STORAGE=s3
DIGITAL_S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
DIGITAL_S3_BUCKET=simarc-digital
DIGITAL_S3_ACCESS_KEY=<access-key-id>
DIGITAL_S3_SECRET_KEY=<secret-access-key>
DIGITAL_S3_REGION=auto
DIGITAL_S3_PATH_STYLE=true
DIGITAL_S3_PREFIX=simarc
```

5. Jalankan ulang SIMARC. Unggah berkas pada salah satu arsip; berkas baru
   akan masuk ke bucket. Buka dari komputer lain (dengan `.env` yang sama)
   melalui tombol **buka berkas** — SIMARC mengunduh ke folder sementara lalu
   membukanya.

### Alternatif gratis lain

- **Backblaze B2** — gratis 10 GB; endpoint `https://s3.<region>.backblazeb2.com`,
  region sesuai akun, path-style `true`.
- **MinIO** — server S3 sendiri (gratis, untuk jaringan kantor).
- **AWS S3** — ada free tier terbatas 12 bulan.

---

## 3. Lewat antarmuka aplikasi

**Integrasi & Sinkronisasi → tab Offsite Backup**:

1. Isi bagian **Object Storage (S3 Compatible)**: Endpoint, Region, Bucket,
   Access Key, Secret Key, Prefix.
2. Pada bagian **Penyimpanan Berkas Digital**, pilih
   **Cloud (S3 / R2 / B2 / MinIO)** atau biarkan **Otomatis**.
3. Klik **Simpan Konfigurasi**, lalu mulai ulang aplikasi.

Nilai dapat juga diisi langsung di `.env`. Variabel `DIGITAL_S3_*` bersifat
opsional; bila kosong, SIMARC memakai `OFFSITE_S3_*`.

---

## 4. Perilaku & catatan

- **Upload**: tombol unggah pada tabel arsip, detail arsip, landing page, dan
  form tambah/ubah arsip semuanya memakai penyimpanan cloud yang sama.
- **Buka berkas**: objek diunduh ke `%TEMP%/simarc-digital/<id-arsip>/`
  (Linux: `/tmp/simarc-digital/...`) lalu dibuka dengan aplikasi default OS.
- **Hapus berkas**: objek cloud ikut dihapus.
- Berkas lama yang sudah tersimpan lokal tetap dapat dibuka; pindahkan manual
  ke cloud bila ingin seragam (unggah ulang melalui aplikasi).
- Kredensial disimpan di `.env` (mode `0600` pada `~/.env`). Jangan menaruh
  Secret Key di repositori publik.
- Kuota gratis R2 10 GB cukup untuk ±10.000 PDF berukuran 1 MB. Untuk arsip
  besar, pertimbangkan B2 atau bucket berbayar.
