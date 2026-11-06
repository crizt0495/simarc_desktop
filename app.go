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

	"arsippro/internal/config"
	"arsippro/internal/database"
	"arsippro/internal/models"

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
