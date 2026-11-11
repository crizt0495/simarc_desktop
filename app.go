package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
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

	// Cache baca (in-memory) untuk data yang mahal diambil dari TiDB Cloud.
	// Setiap halaman (dashboard, arsip, landing, laporan, …) memanggil
	// ListArsipDetail/GetMasterOptions; tanpa cache, tiap navigasi menunggu
	// round-trip cloud 2–8 detik. Cache diinvalidasi otomatis setiap ada
	// perubahan data (lihat invalidateMasterCache).
	cacheMu      sync.RWMutex
	arsipCache   []map[string]interface{}
	arsipCacheAt time.Time
	optsCache    map[string][]map[string]interface{}
	optsCacheAt  time.Time

	// dbErr menyimpan pesan terakhir saat koneksi/migrasi database gagal.
	// Ditampilkan di antarmuka agar "data tidak muncul" punya penjelasan yang
	// bisa ditindaklanjuti alih-alih layar kosong tanpa pesan.
	dbErrMu sync.RWMutex
	dbErr   string
}

func (a *App) setDBErr(msg string) {
	a.dbErrMu.Lock()
	a.dbErr = msg
	a.dbErrMu.Unlock()
}

// GetDBError mengembalikan pesan galat database terakhir (kosong bila normal).
func (a *App) GetDBError() string {
	a.dbErrMu.RLock()
	defer a.dbErrMu.RUnlock()
	return a.dbErr
}

func NewApp() *App {
	return &App{}
}

// startup initializes config, database (GORM AutoMigrate), and services.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Load .env (godotenv). Nilai bawaan yang ditanam di biner dipakai sebagai
	// cadangan bila berkas .env tidak ditemukan atau tidak lengkap.
	config.LoadWithDefaults(embeddedDotEnv)

	// Connect to database (GORM)
	if err := database.Connect(); err != nil {
		a.setDBErr(err.Error())
		fmt.Fprintf(os.Stderr, "[simarc] DB gagal: %v\n", err)
		log.Printf("[simarc] DB gagal: %v", err)
		return
	}
	a.setDBErr("")
	fmt.Fprintf(os.Stderr, "[simarc] Database tersambung\n")
	log.Printf("[simarc] Database tersambung (host=%s db=%s)", config.App.DBHost, config.App.DBName)

	// Run migration (AutoMigrate all models + schema repairs)
	if err := database.Migrate(); err != nil {
		a.setDBErr("migrasi database gagal: " + err.Error())
		fmt.Fprintf(os.Stderr, "[simarc] Migrasi gagal: %v\n", err)
		log.Printf("[simarc] Migrasi gagal: %v", err)
		return
	}
	fmt.Fprintf(os.Stderr, "[simarc] Migrasi selesai\n")

	// Seed default data
	database.SeedIfNeeded()

	// Hangatkan cache data berat di latar belakang. Proses ini berjalan
	// bersamaan dengan pemuatan bundle frontend, sehingga landing page dan
	// navigasi pertama langsung memakai data yang sudah siap.
	go a.ListArsipDetail()
	go a.GetMasterOptions()
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
		"app":      "SIMARC",
		"db_ok":    dbOK,
		"db_error": a.GetDBError(),
		"os":       runtime.GOOS,
		"arch":     runtime.GOARCH,
	}
}

// ReconnectDB mencoba menyambung ulang ke TiDB Cloud tanpa menutup aplikasi.
// Dipakai tombol "Coba lagi" pada pemberitahuan database di antarmuka.
func (a *App) ReconnectDB() map[string]interface{} {
	config.LoadWithDefaults(embeddedDotEnv)
	if err := database.Connect(); err != nil {
		a.setDBErr(err.Error())
		log.Printf("[simarc] Sambung ulang DB gagal: %v", err)
		return map[string]interface{}{"ok": false, "db_error": err.Error()}
	}
	if err := database.Migrate(); err != nil {
		a.setDBErr("migrasi database gagal: " + err.Error())
		log.Printf("[simarc] Migrasi setelah sambung ulang gagal: %v", err)
		return map[string]interface{}{"ok": false, "db_error": a.GetDBError()}
	}
	a.setDBErr("")
	a.invalidateMasterCache()
	go a.ListArsipDetail()
	go a.GetMasterOptions()
	log.Printf("[simarc] Database tersambung ulang (host=%s db=%s)", config.App.DBHost, config.App.DBName)
	return map[string]interface{}{"ok": true, "db_error": ""}
}

// PingBackend confirms bindings work.
func (a *App) PingBackend() string {
	return fmt.Sprintf("pong @ %s", time.Now().Format("15:04:05"))
}

// QuitApp exits the application cleanly (dipanggil dari menu "Keluar").
func (a *App) QuitApp() {
	wailsruntime.Quit(a.ctx)
}

// AppVersion mengembalikan versi aplikasi yang sedang berjalan.
func (a *App) AppVersion() string {
	if v := strings.TrimSpace(os.Getenv("SIMARC_VERSION")); v != "" {
		return v
	}
	return "1.0.0"
}

// GetUpdateInfo memeriksa apakah tersedia rilis terbaru dari GitHub Releases.
func (a *App) GetUpdateInfo() (map[string]interface{}, error) {
	var latest struct {
		TagName string `json:"tag_name"`
		URL     string `json:"browser_download_url"`
		Draft   bool   `json:"draft"`
		Pre     bool   `json:"prerelease"`
	}
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Get("https://api.github.com/repos/crizt0495/simarc_desktop/releases/latest")
	if err != nil {
		return map[string]interface{}{"hasUpdate": false}, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return map[string]interface{}{"hasUpdate": false}, err
	}
	if err := json.Unmarshal(body, &latest); err != nil {
		return map[string]interface{}{"hasUpdate": false}, err
	}
	tag := strings.TrimPrefix(strings.TrimSpace(latest.TagName), "v")
	cur := a.AppVersion()
	hasUpdate := tag != "" && tag != cur && !latest.Draft && !latest.Pre
	return map[string]interface{}{
		"hasUpdate":   hasUpdate,
		"current":     cur,
		"latest":      latest.TagName,
		"downloadURL": latest.URL,
	}, nil
}

// DownloadUpdate mengunduh paket .deb dari URL ke direktori temp lokal.
func (a *App) DownloadUpdate(url string) (string, error) {
	client := &http.Client{Timeout: 10 * time.Minute}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "SIMARC-Updater")
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gagal mengunduh update: status HTTP %d", resp.StatusCode)
	}
	f, err := os.CreateTemp("", "simarc-update-*.deb")
	if err != nil {
		return "", err
	}
	tmp := f.Name()
	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		os.Remove(tmp)
		return "", err
	}
	if err := f.Close(); err != nil {
		os.Remove(tmp)
		return "", err
	}
	return tmp, nil
}

// InstallUpdate memasang paket .deb yang sudah diunduh (membutuhkan privilege).
func (a *App) InstallUpdate(path string) error {
	cmd := exec.Command("pkexec", "dpkg", "-i", path)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("instalasi gagal: %s", strings.TrimSpace(string(out)))
	}
	return nil
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

// arsipDetailRow menampung hasil satu query JOIN arsip + master data.
// Dulu ListArsipDetail memakai 5 Preload terpisah (6 round-trip ke TiDB
// Cloud ≈ 6–8 detik). Dengan JOIN tunggal, seluruh data diambil sekali
// jalan (≈ 2 detik) dan hasilnya di-cache.
type arsipDetailRow struct {
	ID                string     `gorm:"column:id"`
	NomorArsip        string     `gorm:"column:nomor_arsip"`
	NamaArsip         string     `gorm:"column:nama_arsip"`
	Uraian            string     `gorm:"column:uraian"`
	StatusArsip       string     `gorm:"column:status_arsip"`
	UnitKerjaID       string     `gorm:"column:unit_kerja_id"`
	KodeKlasifikasiID string     `gorm:"column:kode_klasifikasi_id"`
	JenisArsipID      *string    `gorm:"column:jenis_arsip_id"`
	PemberkasanID     *string    `gorm:"column:pemberkasan_id"`
	LokasiArsipID     *string    `gorm:"column:lokasi_arsip_id"`
	TanggalDibuat     *time.Time `gorm:"column:tanggal_dibuat"`
	TanggalRetensi    *time.Time `gorm:"column:tanggal_retensi_berakhir"`
	Jumlah            int        `gorm:"column:jumlah"`
	Satuan            string     `gorm:"column:satuan"`
	NilaiAnggaran     *float64   `gorm:"column:nilai_anggaran"`
	NomorSPM          string     `gorm:"column:nomor_spm"`
	FilePath          string     `gorm:"column:file_path"`
	CreatedAt         *time.Time `gorm:"column:created_at"`
	UpdatedAt         *time.Time `gorm:"column:updated_at"`
	UnitNama          *string    `gorm:"column:unit_nama"`
	JenisNama         *string    `gorm:"column:jenis_nama"`
	KKKode            *string    `gorm:"column:kk_kode"`
	KKNama            *string    `gorm:"column:kk_nama"`
	KKPenyusutan      *string    `gorm:"column:kk_penyusutan"`
	KKRetensiAktif    *int       `gorm:"column:kk_retensi_aktif"`
	KKRetensiInaktif  *int       `gorm:"column:kk_retensi_inaktif"`
	LokasiNama        *string    `gorm:"column:lokasi_nama"`
}

// ListArsipDetail returns full arsip records (with joins) for the arsip page.
// Hasil di-cache di memori agar perpindahan halaman (dashboard, arsip,
// landing, laporan, …) tidak mengulang query cloud yang mahal.
func (a *App) ListArsipDetail() []map[string]interface{} {
	if database.DB == nil {
		return []map[string]interface{}{}
	}
	if cached, ok := a.getArsipCache(); ok {
		return cached
	}
	rows := a.queryArsipDetail()
	a.setArsipCache(rows)
	return rows
}

// queryArsipDetail mengambil seluruh arsip beserta relasi master data dalam
// SATU query JOIN (bukan 6 query Preload).
func (a *App) queryArsipDetail() []map[string]interface{} {
	result := []map[string]interface{}{}
	var rows []arsipDetailRow
	err := database.DB.Raw(`
		SELECT
			a.id, a.nomor_arsip, a.nama_arsip, a.uraian, a.status_arsip,
			a.unit_kerja_id, a.kode_klasifikasi_id, a.jenis_arsip_id,
			a.pemberkasan_id, a.lokasi_arsip_id, a.tanggal_dibuat,
			a.tanggal_retensi_berakhir, a.jumlah, a.satuan,
			a.nilai_anggaran, a.nomor_spm, a.file_path,
			a.created_at, a.updated_at,
			u.nama_unit    AS unit_nama,
			j.nama_jenis   AS jenis_nama,
			k.kode_klasifikasi AS kk_kode,
			k.nama_klasifikasi AS kk_nama,
			k.penyusutan_arsip AS kk_penyusutan,
			k.retensi_aktif    AS kk_retensi_aktif,
			k.retensi_inaktif  AS kk_retensi_inaktif,
			l.nama_lokasi  AS lokasi_nama
		FROM arsip a
		LEFT JOIN unit_kerja       u ON u.id = a.unit_kerja_id       AND u.deleted_at IS NULL
		LEFT JOIN jenis_arsip      j ON j.id = a.jenis_arsip_id
		LEFT JOIN kode_klasifikasi k ON k.id = a.kode_klasifikasi_id AND k.deleted_at IS NULL
		LEFT JOIN lokasi_arsips    l ON l.id = a.lokasi_arsip_id     AND l.deleted_at IS NULL
		WHERE a.deleted_at IS NULL
		ORDER BY a.created_at DESC
	`).Scan(&rows).Error
	if err != nil {
		fmt.Fprintf(os.Stderr, "[simarc] gagal memuat arsip: %v\n", err)
		return result
	}

	str := func(p *string) string {
		if p == nil {
			return ""
		}
		return *p
	}
	intv := func(p *int) int {
		if p == nil {
			return 0
		}
		return *p
	}
	tgl := func(p *time.Time) string {
		if p == nil {
			return ""
		}
		return p.Format("2006-01-02")
	}
	ts := func(p *time.Time) string {
		if p == nil {
			return ""
		}
		return p.Format("2006-01-02 15:04:05")
	}

	for _, ar := range rows {
		unit, kategori := "-", "Umum"
		if u := str(ar.UnitNama); u != "" {
			unit = u
		}
		if j := str(ar.JenisNama); j != "" {
			kategori = j
		}
		lokasi := str(ar.LokasiNama)
		if lokasi == "" {
			lokasi = "—"
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
			"tanggal":   tgl(ar.TanggalDibuat),
			"jumlah":    ar.Jumlah,
			"satuan":    ar.Satuan,
			"nilai":     ar.NilaiAnggaran,
			"nomor_spm": ar.NomorSPM,
			"nomorSPM":  ar.NomorSPM,
			// ID relasi untuk filter lengkap halaman publik/landing.
			"unitId":                 ar.UnitKerjaID,
			"kodeKlasifikasiId":      ar.KodeKlasifikasiID,
			"jenisArsipId":           derefStr(ar.JenisArsipID),
			"pemberkasanId":          derefStr(ar.PemberkasanID),
			"lokasiArsipId":          derefStr(ar.LokasiArsipID),
			"tanggalRetensiBerakhir": tgl(ar.TanggalRetensi),
			"kodeKlasifikasiTxt":     str(ar.KKKode),
			// Relasi arsip → kode_klasifikasi: dipakai halaman Pemusnahan untuk
			// mendeteksi arsip berkategori penyusutan "musnah" secara otomatis.
			"kodeKlasifikasiNama": str(ar.KKNama),
			"penyusutanArsip":     strings.ToLower(strings.TrimSpace(str(ar.KKPenyusutan))),
			"retensiAktif":        intv(ar.KKRetensiAktif),
			"retensiInaktif":      intv(ar.KKRetensiInaktif),
			"lokasi":              lokasi,
			"berkas":              ar.FilePath != "",
			"filePath":            ar.FilePath,
			"created":             ts(ar.CreatedAt),
			"updated":             ts(ar.UpdatedAt),
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
// Enam tabel master diambil secara paralel (bukan berurutan) dan hasilnya
// di-cache, sehingga total waktu turun dari ~jumlah semua query menjadi
// ~query terlama. Cache diinvalidasi setiap ada perubahan master data.
func (a *App) GetMasterOptions() map[string][]map[string]interface{} {
	if database.DB == nil {
		return map[string][]map[string]interface{}{}
	}
	if cached, ok := a.getOptsCache(); ok {
		return cached
	}

	out := map[string][]map[string]interface{}{}
	var mu sync.Mutex
	set := func(key string, rows []map[string]interface{}) {
		if rows == nil {
			rows = []map[string]interface{}{}
		}
		mu.Lock()
		out[key] = rows
		mu.Unlock()
	}

	var wg sync.WaitGroup
	wg.Add(6)

	go func() {
		defer wg.Done()
		var units []models.UnitKerja
		database.DB.Order("nama_unit asc").Find(&units)
		u := make([]map[string]interface{}, len(units))
		for i, r := range units {
			u[i] = map[string]interface{}{"id": r.ID, "name": r.NamaUnit}
		}
		set("unitKerja", u)
	}()

	go func() {
		defer wg.Done()
		var klas []models.KodeKlasifikasi
		database.DB.Order("kode_klasifikasi asc").Find(&klas)
		k := make([]map[string]interface{}, len(klas))
		for i, r := range klas {
			k[i] = map[string]interface{}{
				"id": r.ID, "name": r.KodeKlasifikasi + " - " + r.NamaKlasifikasi,
				"kode": r.KodeKlasifikasi, "nama": r.NamaKlasifikasi,
				"retensiAktif": r.RetensiAktif, "retensiInaktif": r.RetensiInaktif,
				"penyusutanArsip": r.PenyusutanArsip, "klasifikasiKeamanan": r.KlasifikasiKeamanan,
				"unitPengolah": r.UnitPengolah,
			}
		}
		set("kodeKlasifikasi", k)
	}()

	go func() {
		defer wg.Done()
		var lokasi []models.LokasiArsip
		database.DB.Order("nama_lokasi asc").Find(&lokasi)
		l := make([]map[string]interface{}, len(lokasi))
		for i, r := range lokasi {
			l[i] = map[string]interface{}{
				"id": r.ID, "name": r.NamaLokasi,
				"deskripsi": r.Deskripsi, "kapasitas": derefStr(r.Kapasitas),
			}
		}
		set("lokasiArsip", l)
	}()

	go func() {
		defer wg.Done()
		var jenis []models.JenisArsip
		database.DB.Order("nama_jenis asc").Find(&jenis)
		j := make([]map[string]interface{}, len(jenis))
		for i, r := range jenis {
			j[i] = map[string]interface{}{
				"id": r.ID, "name": r.NamaJenis,
				"kode": r.KodeJenis, "keterangan": r.Keterangan,
			}
		}
		set("jenisArsip", j)
	}()

	go func() {
		defer wg.Done()
		var berkas []models.Pemberkasan
		database.DB.Order("nama_pemberkasan asc").Find(&berkas)
		p := make([]map[string]interface{}, len(berkas))
		for i, r := range berkas {
			p[i] = map[string]interface{}{
				"id": r.ID, "name": r.NamaPemberkasan,
				"kode": r.KodeBerkas, "tahun": r.Tahun, "status": r.StatusBerkas,
				"unitKerjaId": derefStr(r.UnitKerjaID), "kodeKlasifikasiId": derefStr(r.KodeKlasifikasiID),
			}
		}
		set("pemberkasan", p)
	}()

	go func() {
		defer wg.Done()
		var roles []models.Role
		database.DB.Order("name asc").Find(&roles)
		r := make([]map[string]interface{}, len(roles))
		for i, role := range roles {
			r[i] = map[string]interface{}{"id": role.ID, "name": role.Name}
		}
		set("roles", r)
	}()

	wg.Wait()
	a.setOptsCache(out)
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
			"id":                    p.ID,
			"arsipId":               p.ArsipID,
			"peminjamanStatus":      p.Status,
			"peminjam":              "",
			"tanggalPinjam":         "",
			"tanggalKembaliRencana": "",
			"tanggalKembaliAktual":  "",
			"keperluan":             p.Keperluan,
			"created":               p.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated":               p.UpdatedAt.Format("2006-01-02 15:04:05"),
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
			"id":                b.ID,
			"kodeBerkas":        b.KodeBerkas,
			"namaPemberkasan":   b.NamaPemberkasan,
			"tahun":             b.Tahun,
			"statusBerkas":      b.StatusBerkas,
			"unitKerjaId":       derefStr(b.UnitKerjaID),
			"kodeKlasifikasiId": derefStr(b.KodeKlasifikasiID),
			"created":           b.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated":           b.UpdatedAt.Format("2006-01-02 15:04:05"),
		}
		if b.TanggalMulai != nil {
			row["tanggalMulai"] = b.TanggalMulai.Format("2006-01-02")
		}
		if b.TanggalTutup != nil {
			row["tanggalTutup"] = b.TanggalTutup.Format("2006-01-02")
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
			"namaKegiatan":       p.NamaKegiatan,
			"tanggalPelaksanaan": "",
			"alasanPengajuan":    p.AlasanPengajuan,
			"keteranganApprove":  p.KeteranganApprove,
			"keterangan":         p.Keterangan,
			"userPengaju":        "",
			"tanggalPengajuan":   "",
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
	database.DB.Preload("Role").Preload("UnitKerja").Order("created_at desc").Find(&users)
	for _, u := range users {
		row := map[string]interface{}{
			"id":        u.ID,
			"username":  u.Username,
			"name":      u.Name,
			"role":      "",
			"roleId":    u.RoleID,
			"unitKerja": "",
			"unitId":    derefStr(u.UnitKerjaID),
			"isActive":  u.IsActive,
			"created":   u.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated":   u.UpdatedAt.Format("2006-01-02 15:04:05"),
		}
		if u.Role != nil {
			row["role"] = u.Role.Name
		}
		if u.UnitKerja != nil {
			row["unitKerja"] = u.UnitKerja.NamaUnit
		}
		if u.LastLoginAt != nil {
			row["lastLogin"] = u.LastLoginAt.Format("2006-01-02 15:04:05")
		}
		result = append(result, row)
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
		ID:                    uuid.NewString(),
		ArsipID:               arsipId,
		UserID:                userId,
		Keperluan:             keperluan,
		Status:                "pending",
		TanggalPinjam:         pinjam,
		TanggalKembaliRencana: kembali,
	}
	if err := database.DB.Create(&p).Error; err != nil {
		return map[string]interface{}{"error": err.Error()}, err
	}
	return map[string]interface{}{"id": p.ID, "status": p.Status}, nil
}

// CreateArsip creates a new arsip record.
func (a *App) CreateArsip(nomor, nama, uraian, status, kelas, unit, lokasi string, nilai float64) (map[string]interface{}, error) {
	// Generate UUID for ID
	id := uuid.New().String()

	// Parse status
	statusEnum := "aktif"
	if status != "" {
		statusEnum = status
	}

	// Parse kelas (kode klasifikasi)
	kelasID := kelas

	// Parse unit (unit kerja)
	unitID := unit

	// Create arsip record
	var lokasiPtr *string = nil
	if lokasi != "" {
		lokasiPtr = &lokasi
	}

	var nilaiPtr *float64 = nil
	if nilai != 0 {
		nilaiPtr = &nilai
	}

	var tanggalDibuat time.Time = time.Now().Local()
	tanggalDibuatPtr := &tanggalDibuat

	arsip := models.Arsip{
		ID:                  id,
		NomorArsip:          nomor,
		NamaArsip:           nama,
		Uraian:              uraian,
		StatusArsip:         statusEnum,
		KodeKlasifikasiID:   kelasID,
		UnitKerjaID:         unitID,
		LokasiArsipID:       lokasiPtr,
		TanggalDibuat:       tanggalDibuatPtr,
		TanggalRetensiAkhir: nil,
		NilaiAnggaran:       nilaiPtr,
		Nominal:             nil,
		JenisArsip:          "",
		NomorSPM:            "",
		FilePath:            "",
		FileName:            "",
		OcrText:             "",
		OcrFullText:         "",
		Tags:                "",
		StatusReview:        false,
		Jumlah:              1,
		Satuan:              "Berkas",
		GoogleDriveFileID:   "",
		GoogleDriveURL:      "",
		CreatedAt:           time.Now().Local(),
		UpdatedAt:           time.Now().Local(),
		DeletedAt:           gorm.DeletedAt{},
	}

	if err := database.DB.Create(&arsip).Error; err != nil {
		return map[string]interface{}{"error": err.Error()}, err
	}

	return map[string]interface{}{"id": arsip.ID, "status": arsip.StatusArsip, "nomor": arsip.NomorArsip}, nil
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
			"id":                     ar.ID,
			"nomor":                  ar.NomorArsip,
			"nama":                   ar.NamaArsip,
			"uraian":                 ar.Uraian,
			"status":                 ar.StatusArsip,
			"unit":                   unit,
			"kategori":               kategori,
			"jenisName":              kategori,
			"tanggal":                tanggal,
			"tanggalRetensiBerakhir": retensi,
			"jumlah":                 ar.Jumlah,
			"satuan":                 ar.Satuan,
			"nilai":                  ar.NilaiAnggaran,
			"nomor_spm":              ar.NomorSPM,
			"berkas":                 ar.FilePath != "",
			"created":                ar.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated":                ar.UpdatedAt.Format("2006-01-02 15:04:05"),
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
			"id":                     ar.ID,
			"nomor":                  ar.NomorArsip,
			"nama":                   ar.NamaArsip,
			"uraian":                 ar.Uraian,
			"status":                 ar.StatusArsip,
			"unit":                   unit,
			"kategori":               kategori,
			"jenisName":              kategori,
			"tanggal":                tanggal,
			"tanggalRetensiBerakhir": retensi,
			"jumlah":                 ar.Jumlah,
			"satuan":                 ar.Satuan,
			"nilai":                  ar.NilaiAnggaran,
			"nomor_spm":              ar.NomorSPM,
			"berkas":                 ar.FilePath != "",
			"created":                ar.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated":                ar.UpdatedAt.Format("2006-01-02 15:04:05"),
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
			"namaRole":   r.NamaRole,
			"keterangan": r.Keterangan,
			"created":    r.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated":    r.UpdatedAt.Format("2006-01-02 15:04:05"),
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
		"with":    totals.WithFile,
		"without": totals.Total - totals.WithFile,
		"percent": pct,
	}

	// ── Box stats (record center inventory) ──
	out["boxStats"] = map[string]interface{}{
		"totalRcBoxes":     0,
		"boxMurniSpj":      0,
		"boxMurniNonSpj":   0,
		"boxCampuran":      0,
		"rcDigitalPercent": 0,
		"listAll":          []string{},
		"listMurniSpj":     []string{},
		"listMurniNonSpj":  []string{},
		"listCampuran":     []string{},
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
