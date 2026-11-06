package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"runtime"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/google/uuid"

	"arsippro/internal/config"
	"arsippro/internal/database"
	"arsippro/internal/models"
	"arsippro/internal/services"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App holds the application state.
type App struct {
	ctx            context.Context
	currentUserID  string // set setelah Login() sukses; kosong = mode publik/viewer
	currentProfile map[string]interface{}
}

func NewApp() *App {
	return &App{}
}

// startup initializes config, database (GORM AutoMigrate), and services.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Load .env (godotenv)
	config.Load()

	// Connect to database (GORM)
	if err := database.Connect(); err != nil {
		fmt.Fprintf(os.Stderr, "[simarc] DB gagal: %v\n", err)
		return
	}
	fmt.Fprintf(os.Stderr, "[simarc] DB ok\n")

	// Run migration (AutoMigrate all models + schema repairs)
	if err := database.Migrate(); err != nil {
		fmt.Fprintf(os.Stderr, "[simarc] Migrasi gagal: %v\n", err)
		return
	}
	fmt.Fprintf(os.Stderr, "[simarc] Migrasi selesai\n")

	// Seed default data
	database.SeedIfNeeded()
}

// shutdown closes the database connection.
func (a *App) shutdown(ctx context.Context) {
	if database.DB != nil {
		if sqlDB, err := database.DB.DB(); err == nil {
			sqlDB.Close()
		}
	}
}

// GetStatus returns application status.
func (a *App) GetStatus() map[string]interface{} {
	dbOK := database.Connected()
	return map[string]interface{}{
		"app":   "SIMARC",
		"db_ok": dbOK,
		"os":    runtime.GOOS,
		"arch":  runtime.GOARCH,
	}
}

// PingBackend confirms bindings work.
func (a *App) PingBackend() string {
	return fmt.Sprintf("pong @ %s", time.Now().Format("15:04:05"))
}

// QuitApp exits the application cleanly (dipanggil dari menu "Keluar").
func (a *App) QuitApp() {
	wailsruntime.Quit(a.ctx)
}

// ListArsip returns recent arsip records.
func (a *App) ListArsip() []map[string]interface{} {
	if database.DB == nil {
		return []map[string]interface{}{}
	}
	var arsip []models.Arsip
	database.DB.Order("created_at desc").Limit(200).Find(&arsip)
	result := make([]map[string]interface{}, len(arsip))
	for i, ar := range arsip {
		result[i] = map[string]interface{}{
			"id":      ar.ID,
			"nomor":   ar.NomorArsip,
			"nama":    ar.NamaArsip,
			"status":  ar.StatusArsip,
			"created": ar.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated": ar.UpdatedAt.Format("2006-01-02 15:04:05"),
		}
	}
	return result
}

// GetDashboardStats returns KPI data matching the reference app's dashboard.
func (a *App) GetDashboardStats() map[string]interface{} {
	if database.DB == nil {
		return map[string]interface{}{"error": "database not connected"}
	}
	db := database.DB

	var stats struct {
		Total          int64 `gorm:"column:total"`
		TotalItems     int64 `gorm:"column:total_items"`
		Aktif          int64 `gorm:"column:aktif"`
		Inaktif        int64 `gorm:"column:inaktif"`
		SiapPenyusutan int64 `gorm:"column:siap_penyusutan"`
		Musnah         int64 `gorm:"column:musnah"`
		WithFile       int64 `gorm:"column:with_file"`
		WithoutFile    int64 `gorm:"column:without_file"`
		Spj            int64 `gorm:"column:spj"`
		NonSpj         int64 `gorm:"column:non_spj"`
		Unclassified   int64 `gorm:"column:unclassified"`
	}

	db.Raw(`
		SELECT
			COUNT(*) as total,
			COALESCE(SUM(jumlah), 0) as total_items,
			SUM(CASE WHEN status_arsip IN ('aktif','diberkaskan') THEN 1 ELSE 0 END) as aktif,
			SUM(CASE WHEN status_arsip = 'inaktif' THEN 1 ELSE 0 END) as inaktif,
			SUM(CASE WHEN status_arsip = 'siap_penyusutan' THEN 1 ELSE 0 END) as siap_penyusutan,
			SUM(CASE WHEN status_arsip = 'musnah' THEN 1 ELSE 0 END) as musnah,
			SUM(CASE WHEN file_path IS NOT NULL AND file_path != '' THEN 1 ELSE 0 END) as with_file,
			SUM(CASE WHEN file_path IS NULL OR file_path = '' THEN 1 ELSE 0 END) as without_file,
			SUM(CASE WHEN jenis_arsip = 'SPJ' THEN 1 ELSE 0 END) as spj,
			SUM(CASE WHEN jenis_arsip = 'Non SPJ' THEN 1 ELSE 0 END) as non_spj,
			SUM(CASE WHEN jenis_arsip IS NULL OR jenis_arsip NOT IN ('SPJ','Non SPJ') THEN 1 ELSE 0 END) as unclassified
		FROM arsip
		WHERE deleted_at IS NULL
	`).Scan(&stats)

	var pemberkasanCount int64
	db.Model(&models.Pemberkasan{}).Count(&pemberkasanCount)

	return map[string]interface{}{
		"total":           stats.Total,
		"total_items":     stats.TotalItems,
		"aktif":           stats.Aktif,
		"inaktif":         stats.Inaktif,
		"siap_penyusutan": stats.SiapPenyusutan,
		"musnah":          stats.Musnah,
		"with_file":       stats.WithFile,
		"without_file":    stats.WithoutFile,
		"spj":             stats.Spj,
		"non_spj":         stats.NonSpj,
		"unclassified":    stats.Unclassified,
		"pemberkasan":     pemberkasanCount,
	}
}

// GetProfile returns the logged-in user representation for the UI.
// Bila belum login (membuka landing page publik), kembalikan nama sumber
// dari user aktif pertama sebagai fallback lengai; setelah Login() sukses
// profil yang ditampilkan adalah pengguna yang benar-benar terautentikasi.
func (a *App) GetProfile() map[string]interface{} {
	if a.currentProfile != nil {
		return a.currentProfile
	}
	out := map[string]interface{}{"name": "Pengguna", "role": "Pengguna"}
	if database.DB == nil {
		return out
	}
	var u models.User
	if err := database.DB.Preload("Role").Where("is_active = ?", true).
		Order("created_at asc").First(&u).Error; err == nil && u.Name != "" {
		role := "Pengguna"
		if u.Role != nil && u.Role.Name != "" {
			role = u.Role.Name
		}
		out["name"] = u.Name
		out["role"] = role
	}
	return out
}

// Login memverifikasi username/password (hash bcrypt pada tabel users).
// Sukses → profil tersimpan di sesi aplikasi dan dikembalikan.
// Gagal → error dikirim ke frontend (reject promise) untuk ditampilkan.
func (a *App) Login(username, password string) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	if strings.TrimSpace(username) == "" || password == "" {
		return nil, fmt.Errorf("username dan password wajib diisi")
	}
	var u models.User
	if err := database.DB.Preload("Role").Where("username = ?", strings.TrimSpace(username)).First(&u).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("username tidak ditemukan")
		}
		return nil, fmt.Errorf("query gagal: %v", err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password)); err != nil {
		return nil, fmt.Errorf("password salah")
	}
	role := "Pengguna"
	if u.Role != nil && u.Role.Name != "" {
		role = u.Role.Name
	}
	a.currentUserID = u.ID
	a.currentProfile = map[string]interface{}{"name": u.Name, "role": role}
	return a.currentProfile, nil
}

// Logout menghabiskan sesi login aplikasi (kembali ke mode publik/viewer).
func (a *App) Logout() {
	a.currentUserID = ""
	a.currentProfile = nil
}

// ListArsipDetail returns full arsip records (with joins) for the arsip page.
func (a *App) ListArsipDetail() []map[string]interface{} {
	result := []map[string]interface{}{}
	if database.DB == nil {
		return result
	}
	var arsip []models.Arsip
	database.DB.
		Preload("UnitKerja").
		Preload("JenisArsipRel").
		Preload("KodeKlasifikasi").
		Preload("Pemberkasan").
		Order("created_at desc").Limit(200).Find(&arsip)
	for _, ar := range arsip {
		unit, kategori := "-", "Umum"
		if ar.UnitKerja != nil && ar.UnitKerja.NamaUnit != "" {
			unit = ar.UnitKerja.NamaUnit
		}
		if ar.JenisArsipRel != nil && ar.JenisArsipRel.NamaJenis != "" {
			kategori = ar.JenisArsipRel.NamaJenis
		}
		tanggal := ""
		if ar.TanggalDibuat != nil {
			tanggal = ar.TanggalDibuat.Format("2006-01-02")
		}
		result = append(result, map[string]interface{}{
			"id":        ar.ID,
			"nomor":     ar.NomorArsip,
			"nama":      ar.NamaArsip,
			"uraian":    ar.Uraian,
			"status":    ar.StatusArsip,
			"unit":      unit,
			"kategori":  kategori,
			"jenisName": kategori,
			"tanggal":   tanggal,
			"jumlah":    ar.Jumlah,
			"satuan":    ar.Satuan,
			"nilai":     ar.NilaiAnggaran,
			"nomor_spm": ar.NomorSPM,
			// ID relasi untuk filter lengkap halaman publik/landing.
			"unitId":             ar.UnitKerjaID,
			"kodeKlasifikasiId":  ar.KodeKlasifikasiID,
			"jenisArsipId":       derefStr(ar.JenisArsipID),
			"pemberkasanId":      derefStr(ar.PemberkasanID),
			"kodeKlasifikasiTxt": func() string {
				if ar.KodeKlasifikasi != nil {
					return ar.KodeKlasifikasi.KodeKlasifikasi
				}
				return ""
			}(),
			"berkas":   ar.FilePath != "",
			"created":  ar.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated":  ar.UpdatedAt.Format("2006-01-02 15:04:05"),
		})
	}
	return result
}

// derefStr nil-aman untuk kolom relasi *string.
func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// GetMasterOptions returns master-data dropdown options for the arsip filter panel.
func (a *App) GetMasterOptions() map[string][]map[string]interface{} {
	out := map[string][]map[string]interface{}{}
	if database.DB == nil {
		return out
	}
	opts := func(rows []map[string]interface{}) []map[string]interface{} {
		if rows == nil {
			return []map[string]interface{}{}
		}
		return rows
	}

	var units []models.UnitKerja
	database.DB.Order("nama_unit asc").Find(&units)
	u := make([]map[string]interface{}, len(units))
	for i, r := range units {
		u[i] = map[string]interface{}{"id": r.ID, "name": r.NamaUnit}
	}
	out["unitKerja"] = opts(u)

	var klas []models.KodeKlasifikasi
	database.DB.Order("kode_klasifikasi asc").Find(&klas)
	k := make([]map[string]interface{}, len(klas))
	for i, r := range klas {
		k[i] = map[string]interface{}{"id": r.ID, "name": r.KodeKlasifikasi + " - " + r.NamaKlasifikasi}
	}
	out["kodeKlasifikasi"] = opts(k)

	var lokasi []models.LokasiArsip
	database.DB.Order("nama_lokasi asc").Find(&lokasi)
	l := make([]map[string]interface{}, len(lokasi))
	for i, r := range lokasi {
		l[i] = map[string]interface{}{"id": r.ID, "name": r.NamaLokasi}
	}
	out["lokasiArsip"] = opts(l)

	var jenis []models.JenisArsip
	database.DB.Order("nama_jenis asc").Find(&jenis)
	j := make([]map[string]interface{}, len(jenis))
	for i, r := range jenis {
		j[i] = map[string]interface{}{"id": r.ID, "name": r.NamaJenis}
	}
	out["jenisArsip"] = opts(j)

	var berkas []models.Pemberkasan
	database.DB.Order("nama_pemberkasan asc").Find(&berkas)
	p := make([]map[string]interface{}, len(berkas))
	for i, r := range berkas {
		p[i] = map[string]interface{}{"id": r.ID, "name": r.NamaPemberkasan}
	}
	out["pemberkasan"] = opts(p)

	return out
}

// ListPeminjaman returns archive borrowing (peminjaman) records joined with
// the arsip detail (for the Detail modal) and the peminat (user).
func (a *App) ListPeminjaman() []map[string]interface{} {
	result := []map[string]interface{}{}
	if database.DB == nil {
		return result
	}
	var list []models.PeminjamanArsip
	database.DB.Preload("Arsip").Preload("User").Order("created_at desc").Find(&list)
	for _, p := range list {
		row := map[string]interface{}{
			"id":               p.ID,
			"arsipId":          p.ArsipID,
			"peminjamanStatus": p.Status,
			"peminjam":         "",
			"tanggalPinjam":    "",
			"tanggalKembaliRencana": "",
			"tanggalKembaliAktual": "",
			"keperluan":        p.Keperluan,
			"created":          p.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated":          p.UpdatedAt.Format("2006-01-02 15:04:05"),
		}
		if p.User != nil {
			row["peminjam"] = p.User.Name
		}
		if p.TanggalPinjam != nil {
			row["tanggalPinjam"] = p.TanggalPinjam.Format("2006-01-02")
		}
		if p.TanggalKembaliRencana != nil {
			row["tanggalKembaliRencana"] = p.TanggalKembaliRencana.Format("2006-01-02")
		}
		if p.TanggalKembaliAktual != nil {
			row["tanggalKembaliAktual"] = p.TanggalKembaliAktual.Format("2006-01-02")
		}
		if p.Arsip != nil {
			ar := p.Arsip
			unit := "-"
			if ar.UnitKerja != nil && ar.UnitKerja.NamaUnit != "" {
				unit = ar.UnitKerja.NamaUnit
			}
			kategori := "Umum"
			if ar.JenisArsipRel != nil && ar.JenisArsipRel.NamaJenis != "" {
				kategori = ar.JenisArsipRel.NamaJenis
			}
			tanggal := ""
			if ar.TanggalDibuat != nil {
				tanggal = ar.TanggalDibuat.Format("2006-01-02")
			}
			row["nomor"] = ar.NomorArsip
			row["nama"] = ar.NamaArsip
			row["uraian"] = ar.Uraian
			row["status"] = ar.StatusArsip
			row["unit"] = unit
			row["kategori"] = kategori
			row["jenisName"] = kategori
			row["tanggal"] = tanggal
			row["jumlah"] = ar.Jumlah
			row["satuan"] = ar.Satuan
			row["nilai"] = ar.NilaiAnggaran
			row["nomor_spm"] = ar.NomorSPM
			row["berkas"] = ar.FilePath != ""
			row["created"] = ar.CreatedAt.Format("2006-01-02 15:04:05")
			row["updated"] = ar.UpdatedAt.Format("2006-01-02 15:04:05")
		}
		result = append(result, row)
	}
	return result
}

// ListPemberkasan returns archive berkas (pemberkasan) with the arsip
// aggregates and the representative arsip fields for the Detail modal.
func (a *App) ListPemberkasan() []map[string]interface{} {
	result := []map[string]interface{}{}
	if database.DB == nil {
		return result
	}
	var berkas []models.Pemberkasan
	database.DB.Preload("Arsip").Order("tahun asc, nama_pemberkasan asc").Find(&berkas)
	for _, b := range berkas {
		row := map[string]interface{}{
			"id":            b.ID,
			"kodeBerkas":   b.KodeBerkas,
			"namaPemberkasan": b.NamaPemberkasan,
			"tahun":        b.Tahun,
			"statusBerkas": b.StatusBerkas,
			"unitKerjaId": derefStr(b.UnitKerjaID),
			"created":      b.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated":      b.UpdatedAt.Format("2006-01-02 15:04:05"),
		}
		if b.UnitKerja != nil {
			row["unitKerja"] = b.UnitKerja.NamaUnit
		}
		if len(b.Arsip) > 0 {
			ar := b.Arsip[0]
			unit := "-"
			if ar.UnitKerja != nil && ar.UnitKerja.NamaUnit != "" {
				unit = ar.UnitKerja.NamaUnit
			}
			kategori := "Umum"
			if ar.JenisArsipRel != nil && ar.JenisArsipRel.NamaJenis != "" {
				kategori = ar.JenisArsipRel.NamaJenis
			}
			tanggal := ""
			if ar.TanggalDibuat != nil {
				tanggal = ar.TanggalDibuat.Format("2006-01-02")
			}
			row["arsipId"] = ar.ID
			row["nomor"] = ar.NomorArsip
			row["nama"] = ar.NamaArsip
			row["uraian"] = ar.Uraian
			row["status"] = ar.StatusArsip
			row["unit"] = unit
			row["kategori"] = kategori
			row["jenisName"] = kategori
			row["tanggal"] = tanggal
			row["jumlah"] = ar.Jumlah
			row["satuan"] = ar.Satuan
			row["nilai"] = ar.NilaiAnggaran
			row["nomor_spm"] = ar.NomorSPM
			row["berkas"] = ar.FilePath != ""
			row["created"] = ar.CreatedAt.Format("2006-01-02 15:04:05")
			row["updated"] = ar.UpdatedAt.Format("2006-01-02 15:04:05")
		}
		row["arsipCount"] = len(b.Arsip)
		result = append(result, row)
	}
	return result
}

// ListPemusnahan returns destruction (pemusnahan) requests joined with arsip.
func (a *App) ListPemusnahan() []map[string]interface{} {
	result := []map[string]interface{}{}
	if database.DB == nil {
		return result
	}
	var list []models.PemusnahanArsip
	database.DB.Preload("Arsip").Preload("UserPengaju").Order("created_at desc").Find(&list)
	for _, p := range list {
	 row := map[string]interface{}{
			"id":                 p.ID,
			"arsipId":            p.ArsipID,
			"status":             p.Status,
			"namaKegiatan":      p.NamaKegiatan,
			"tanggalPelaksanaan": "",
			"alasanPengajuan":   p.AlasanPengajuan,
			"keteranganApprove": p.KeteranganApprove,
			"keterangan":        p.Keterangan,
			"userPengaju":       "",
			"tanggalPengajuan":  "",
			"isAuto":             p.IsAuto,
			"created":            p.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated":            p.UpdatedAt.Format("2006-01-02 15:04:05"),
		}
		if p.UserPengaju != nil {
			row["userPengaju"] = p.UserPengaju.Name
		}
		if p.TanggalPelaksanaan != nil {
			row["tanggalPelaksanaan"] = p.TanggalPelaksanaan.Format("2006-01-02")
		}
		if p.TanggalPengajuan != nil {
			row["tanggalPengajuan"] = p.TanggalPengajuan.Format("2006-01-02")
		}
		if p.Arsip != nil {
			ar := p.Arsip
			unit := "-"
			if ar.UnitKerja != nil && ar.UnitKerja.NamaUnit != "" {
				unit = ar.UnitKerja.NamaUnit
			}
			kategori := "Umum"
			if ar.JenisArsipRel != nil && ar.JenisArsipRel.NamaJenis != "" {
				kategori = ar.JenisArsipRel.NamaJenis
			}
			tanggal := ""
			if ar.TanggalDibuat != nil {
				tanggal = ar.TanggalDibuat.Format("2006-01-02")
			}
			row["nomor"] = ar.NomorArsip
			row["nama"] = ar.NamaArsip
			row["uraian"] = ar.Uraian
			row["status"] = ar.StatusArsip
			row["unit"] = unit
			row["kategori"] = kategori
			row["jenisName"] = kategori
			row["tanggal"] = tanggal
			row["jumlah"] = ar.Jumlah
			row["satuan"] = ar.Satuan
			row["nilai"] = ar.NilaiAnggaran
			row["nomor_spm"] = ar.NomorSPM
			row["berkas"] = ar.FilePath != ""
			row["created"] = ar.CreatedAt.Format("2006-01-02 15:04:05")
			row["updated"] = ar.UpdatedAt.Format("2006-01-02 15:04:05")
		}
		result = append(result, row)
	}
	return result
}

// ListActivityLogs returns recent activity log entries joined with the actor.
func (a *App) ListActivityLogs() []map[string]interface{} {
	result := []map[string]interface{}{}
	if database.DB == nil {
		return result
	}
	var logs []models.ActivityLog
	database.DB.Preload("User").Order("created_at desc").Limit(200).Find(&logs)
	for _, lg := range logs {
		userName := "Sistem"
		if lg.User != nil && lg.User.Name != "" {
			userName = lg.User.Name
		}
		result = append(result, map[string]interface{}{
			"id":          lg.ID,
			"userId":      lg.UserID,
			"userName":    userName,
			"action":      lg.Action,
			"description": lg.Description,
			"modelType":   lg.ModelType,
			"modelId":     lg.ModelID,
			"createdAt":   lg.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}
	return result
}

// ListUsers returns system user accounts for master-data pages.
func (a *App) ListUsers() []map[string]interface{} {
	result := []map[string]interface{}{}
	if database.DB == nil {
		return result
	}
	var users []models.User
	database.DB.Order("created_at desc").Find(&users)
	for _, u := range users {
		result = append(result, map[string]interface{}{
			"id":        u.ID,
			"username": u.Username,
			"name":      u.Name,
			"role":      "",
			"unitKerja": "",
			"isActive":  u.IsActive,
			"created":   u.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated":   u.UpdatedAt.Format("2006-01-02 15:04:05"),
		})
		if u.Role != nil {
			result[len(result)-1]["role"] = u.Role.Name
		}
		if u.UnitKerja != nil {
			result[len(result)-1]["unitKerja"] = u.UnitKerja.NamaUnit
		}
	}
	return result
}

// CreatePeminjaman creates a new archive borrowing (peminjaman) request.
func (a *App) CreatePeminjaman(arsipId, userId, keperluan, tanggalPinjam, tanggalKembaliRencana string) (map[string]interface{}, error) {
	var pinjam, kembali *time.Time
	if t, err := time.Parse("2006-01-02", tanggalPinjam); err == nil {
		pinjam = &t
	}
	if t, err := time.Parse("2006-01-02", tanggalKembaliRencana); err == nil {
		kembali = &t
	}
	p := models.PeminjamanArsip{
		ID:                     uuid.NewString(),
		ArsipID:                arsipId,
		UserID:                 userId,
		Keperluan:              keperluan,
		Status:                 "pending",
		TanggalPinjam:          pinjam,
		TanggalKembaliRencana: kembali,
	}
	if err := database.DB.Create(&p).Error; err != nil {
		return map[string]interface{}{"error": err.Error()}, err
	}
	return map[string]interface{}{"id": p.ID, "status": p.Status}, nil
}

// ListPenyusutan returns arsip yang kriteria retensinya sudah habis (siap diproses pemusnahan).
func (a *App) ListPenyusutan() []map[string]interface{} {
	result := []map[string]interface{}{}
	if database.DB == nil {
		return result
	}
	arsipList := (&services.SmartDisposalService{}).GetEligibleArsip()
	for _, ar := range arsipList {
		unit := "-"
		if ar.UnitKerja != nil && ar.UnitKerja.NamaUnit != "" {
			unit = ar.UnitKerja.NamaUnit
		}
		kategori := "Umum"
		if ar.JenisArsipRel != nil && ar.JenisArsipRel.NamaJenis != "" {
			kategori = ar.JenisArsipRel.NamaJenis
		}
		tanggal := ""
		if ar.TanggalDibuat != nil {
			tanggal = ar.TanggalDibuat.Format("2006-01-02")
		}
		retensi := ""
		if ar.TanggalRetensiAkhir != nil {
			retensi = ar.TanggalRetensiAkhir.Format("2006-01-02")
		}
		result = append(result, map[string]interface{}{
			"id":                  ar.ID,
			"nomor":               ar.NomorArsip,
			"nama":                ar.NamaArsip,
			"uraian":              ar.Uraian,
			"status":              ar.StatusArsip,
			"unit":                unit,
			"kategori":            kategori,
			"jenisName":           kategori,
			"tanggal":             tanggal,
			"tanggalRetensiBerakhir": retensi,
			"jumlah":              ar.Jumlah,
			"satuan":              ar.Satuan,
			"nilai":               ar.NilaiAnggaran,
			"nomor_spm":           ar.NomorSPM,
			"berkas":              ar.FilePath != "",
			"created":             ar.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated":             ar.UpdatedAt.Format("2006-01-02 15:04:05"),
		})
	}
	return result
}

// ListRetensiExpiring returns arsip yang retensi berakhir dalam rentang hari.
func (a *App) ListRetensiExpiring(days int) []map[string]interface{} {
	result := []map[string]interface{}{}
	if database.DB == nil {
		return result
	}
	if days <= 0 {
		days = 90
	}
	arsipList := (&services.RetentionSchedulerService{}).GetExpiringArsip(days)
	for _, ar := range arsipList {
		unit := "-"
		if ar.UnitKerja != nil && ar.UnitKerja.NamaUnit != "" {
			unit = ar.UnitKerja.NamaUnit
		}
		kategori := "Umum"
		if ar.JenisArsipRel != nil && ar.JenisArsipRel.NamaJenis != "" {
			kategori = ar.JenisArsipRel.NamaJenis
		}
		tanggal := ""
		if ar.TanggalDibuat != nil {
			tanggal = ar.TanggalDibuat.Format("2006-01-02")
		}
		retensi := ""
		if ar.TanggalRetensiAkhir != nil {
			retensi = ar.TanggalRetensiAkhir.Format("2006-01-02")
		}
		result = append(result, map[string]interface{}{
			"id":                  ar.ID,
			"nomor":               ar.NomorArsip,
			"nama":                ar.NamaArsip,
			"uraian":              ar.Uraian,
			"status":              ar.StatusArsip,
			"unit":                unit,
			"kategori":            kategori,
			"jenisName":           kategori,
			"tanggal":             tanggal,
			"tanggalRetensiBerakhir": retensi,
			"jumlah":              ar.Jumlah,
			"satuan":              ar.Satuan,
			"nilai":               ar.NilaiAnggaran,
			"nomor_spm":           ar.NomorSPM,
			"berkas":              ar.FilePath != "",
			"created":             ar.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated":             ar.UpdatedAt.Format("2006-01-02 15:04:05"),
		})
	}
	return result
}

// GetBlockchainVerify runs the blockchain hash-chain verification.
func (a *App) GetBlockchainVerify() map[string]interface{} {
	if database.DB == nil {
		return map[string]interface{}{
			"total_blocks":          0,
			"invalid_blocks":        0,
			"invalid_block_numbers": []uint64{},
			"is_valid":              true,
		}
	}
	return (&services.BlockchainAuditService{}).VerifyChain()
}

// GetArsipGrowth returns archive creation growth per month (last N months).
func (a *App) GetArsipGrowth() []map[string]interface{} {
	if database.DB == nil {
		return []map[string]interface{}{}
	}
	return (&services.AnalyticsService{}).GetArsipGrowth(12)
}

// ListRoles returns system roles.
func (a *App) ListRoles() []map[string]interface{} {
	result := []map[string]interface{}{}
	if database.DB == nil {
		return result
	}
	var roles []models.Role
	database.DB.Order("created_at desc").Find(&roles)
	for _, r := range roles {
		result = append(result, map[string]interface{}{
			"id":         r.ID,
			"name":       r.Name,
			"namaRole":  r.NamaRole,
			"keterangan": r.Keterangan,
			"created":   r.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated":   r.UpdatedAt.Format("2006-01-02 15:04:05"),
		})
	}
	return result
}

// GetDashboardExtras returns the remaining dashboard data:
// recent activities, digital-file stats, box inventory, and the 6-month
// archive growth forecast (linear regression over last 6 months).
func (a *App) GetDashboardExtras() map[string]interface{} {
	out := map[string]interface{}{}
	if database.DB == nil {
		out["error"] = "database not connected"
		return out
	}
	db := database.DB

	// ── Recent activities ──
	var logs []models.ActivityLog
	db.Preload("User").Order("created_at desc").Limit(10).Find(&logs)
	act := make([]map[string]interface{}, len(logs))
	for i, lg := range logs {
		name := "Sistem"
		if lg.User != nil && lg.User.Name != "" {
			name = lg.User.Name
		}
		act[i] = map[string]interface{}{
			"userName":    name,
			"description": lg.Description,
			"action":      lg.Action,
			"createdAt":   lg.CreatedAt.Format("02 Jan 2006 15:04"),
		}
	}
	out["recentActivities"] = act

	// ── Digital file stats ──
	var totals struct {
		Total    int64
		WithFile int64
	}
	db.Raw(`SELECT COUNT(*) as total,
			SUM(CASE WHEN file_path IS NOT NULL AND file_path != '' THEN 1 ELSE 0 END) as with_file
		FROM arsip WHERE deleted_at IS NULL`).Scan(&totals)
	pct := float64(0)
	if totals.Total > 0 {
		pct = float64(totals.WithFile) / float64(totals.Total) * 100
	}
	out["digitalFile"] = map[string]interface{}{
		"with":     totals.WithFile,
		"without":  totals.Total - totals.WithFile,
		"percent":  pct,
	}

	// ── Box stats (record center inventory) ──
	out["boxStats"] = map[string]interface{}{
		"totalRcBoxes":    0,
		"boxMurniSpj":     0,
		"boxMurniNonSpj":  0,
		"boxCampuran":     0,
		"rcDigitalPercent": 0,
		"listAll":         []string{},
		"listMurniSpj":    []string{},
		"listMurniNonSpj": []string{},
		"listCampuran":    []string{},
	}

	// ── Forecast: 6-month linear regression on monthly archive growth ──
	type mrow struct {
		Month string
		Cnt   int64
	}
	var rows []mrow
	db.Raw(`SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as cnt
		FROM arsip WHERE deleted_at IS NULL
		GROUP BY month ORDER BY month asc`).Scan(&rows)
	counts := map[string]int64{}
	for _, r := range rows {
		counts[r.Month] = r.Cnt
	}
	// Build the last 6 observed months (zero-filled) then forecast 6 ahead.
	months := make([]string, 6)
	keys := make([]string, 6)
	now := time.Now()
	base := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	observed := make([]float64, 6)
	for i := 5; i >= 0; i-- {
		t := base.AddDate(0, -(i), 0)
		keys[5-i] = t.Format("2006-01")
		months[5-i] = t.Format("Jan '06")
		observed[5-i] = float64(counts[keys[5-i]])
	}
	// least squares on observed months
	n := float64(6)
	sx, sy, sxy, sx2 := float64(0), float64(0), float64(0), float64(0)
	for i, y := range observed {
		x := float64(i)
		sx += x
		sy += y
		sxy += x * y
		sx2 += x * x
	}
	den := n*sx2 - sx*sx
	slope, intercept := float64(0), float64(sy/n)
	if den != 0 {
		slope = (n*sxy - sx*sy) / den
		intercept = (sy - slope*sx) / n
	}
	forecast := make([]map[string]interface{}, 6)
	for i := 0; i < 6; i++ {
		t := base.AddDate(0, i+1, 0)
		v := intercept + slope*float64(6+i)
		if v < 0 {
			v = 0
		}
		forecast[i] = map[string]interface{}{
			"month":          t.Format("Jan '06"),
			"predictedCount": int64(v + 0.5),
		}
	}
	out["forecast"] = forecast
	out["observed"] = observed

	return out
}

// Wails runtime helper (unused but kept for future use)
var _ = wailsruntime.EventsEmit
