package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/csv"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
	qrcode "github.com/skip2/go-qrcode"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"arsippro/internal/config"
	"arsippro/internal/database"
	"arsippro/internal/models"
	"arsippro/internal/services"
	"arsippro/internal/syncdb"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ── Helpers ───────────────────────────────────────────────────────────────────

func mStr(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return strings.TrimSpace(s)
	}
	return strings.TrimSpace(fmt.Sprint(v))
}

func mFloat(m map[string]interface{}, key string) float64 {
	v, ok := m[key]
	if !ok || v == nil {
		return 0
	}
	switch t := v.(type) {
	case float64:
		return t
	case float32:
		return float64(t)
	case int:
		return float64(t)
	case int64:
		return float64(t)
	case string:
		f, _ := strconv.ParseFloat(strings.TrimSpace(t), 64)
		return f
	}
	return 0
}

func mInt(m map[string]interface{}, key string) int {
	return int(mFloat(m, key))
}

// currencyFloat membaca nominal rupiah yang mungkin dikirim dengan pemisah
// ribuan id-ID, mis. "1.500.000", "Rp 1.500.000", atau "517.999,99".
func currencyFloat(m map[string]interface{}, key string) float64 {
	v, ok := m[key]
	if !ok || v == nil {
		return 0
	}
	switch t := v.(type) {
	case float64:
		return t
	case float32:
		return float64(t)
	case int:
		return float64(t)
	case int64:
		return float64(t)
	case string:
		s := strings.TrimSpace(t)
		s = strings.ReplaceAll(s, "Rp", "")
		s = strings.ReplaceAll(s, "rp", "")
		s = strings.ReplaceAll(s, " ", "")
		s = strings.ReplaceAll(s, "\u00a0", "")
		if s == "" {
			return 0
		}
		if strings.Contains(s, ",") {
			// id-ID: titik = ribuan, koma = desimal.
			s = strings.ReplaceAll(s, ".", "")
			s = strings.ReplaceAll(s, ",", ".")
		} else if strings.Count(s, ".") > 1 {
			s = strings.ReplaceAll(s, ".", "")
		}
		f, _ := strconv.ParseFloat(s, 64)
		return f
	}
	return 0
}

func mBool(m map[string]interface{}, key string) bool {
	v, ok := m[key]
	if !ok || v == nil {
		return false
	}
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return t == "true" || t == "1" || t == "on"
	case float64:
		return t != 0
	case int:
		return t != 0
	}
	return false
}

func hasKey(m map[string]interface{}, key string) bool {
	_, ok := m[key]
	return ok
}

func strPtr(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	v := strings.TrimSpace(s)
	return &v
}

func parseDate(s string) *time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	layouts := []string{"2006-01-02", "02-01-2006", "2006/01/02", time.RFC3339}
	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
			return &t
		}
	}
	return nil
}

func stringSlice(v interface{}) []string {
	switch t := v.(type) {
	case []string:
		return t
	case []interface{}:
		out := make([]string, 0, len(t))
		for _, item := range t {
			if s := strings.TrimSpace(fmt.Sprint(item)); s != "" {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}

func (a *App) actingUserID() string {
	if a.currentUserID != "" {
		return a.currentUserID
	}
	if database.DB == nil {
		return ""
	}
	var u models.User
	if err := database.DB.Where("is_active = ?", true).Order("created_at asc").First(&u).Error; err == nil {
		return u.ID
	}
	return ""
}

func (a *App) writeActivity(action, description, modelType, modelID string) {
	if database.DB == nil {
		return
	}
	var userID *string
	if id := a.actingUserID(); id != "" {
		userID = &id
	}
	_ = database.DB.Create(&models.ActivityLog{
		ID:          uuid.NewString(),
		UserID:      userID,
		Action:      action,
		Description: description,
		ModelType:   modelType,
		ModelID:     modelID,
	}).Error
	// Setiap aktivitas tulis menandakan data berubah → buang cache baca.
	a.invalidateMasterCache()
}

// ── ARSIP (Tambah / Ubah / Hapus / Pindah) ────────────────────────────────────

// CreateArsipFull membuat arsip baru dengan seluruh field form Tambah Arsip.
func (a *App) CreateArsipFull(in map[string]interface{}) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	nama := mStr(in, "nama")
	kelas := mStr(in, "kodeKlasifikasiId")
	unit := mStr(in, "unitKerjaId")
	if nama == "" {
		return nil, fmt.Errorf("nama arsip wajib diisi")
	}
	if kelas == "" {
		return nil, fmt.Errorf("kode klasifikasi wajib dipilih")
	}
	if unit == "" {
		return nil, fmt.Errorf("unit kerja wajib dipilih")
	}

	nomor := mStr(in, "nomor")
	if nomor == "" {
		nomor = (&services.ArsipService{}).GenerateNomorArsip()
	}
	status := mStr(in, "status")
	if status == "" {
		status = "aktif"
	}

	ar := models.Arsip{
		ID:                uuid.NewString(),
		NomorArsip:        nomor,
		NamaArsip:         nama,
		Uraian:            mStr(in, "uraian"),
		StatusArsip:       status,
		KodeKlasifikasiID: kelas,
		UnitKerjaID:       unit,
		JenisArsipID:      strPtr(mStr(in, "jenisArsipId")),
		PemberkasanID:     strPtr(mStr(in, "pemberkasanId")),
		LokasiArsipID:     strPtr(mStr(in, "lokasiArsipId")),
		NomorSPM:          mStr(in, "nomorSPM"),
		Jumlah:            1,
		Satuan:            "Berkas",
		JenisArsip:        "",
	}
	if v := mInt(in, "jumlah"); v > 0 {
		ar.Jumlah = v
	}
	if v := mStr(in, "satuan"); v != "" {
		ar.Satuan = v
	}
	if f := currencyFloat(in, "nilaiAnggaran"); f != 0 {
		ar.NilaiAnggaran = &f
	}
	if d := parseDate(mStr(in, "tanggalDibuat")); d != nil {
		ar.TanggalDibuat = d
	} else {
		now := time.Now().Local()
		ar.TanggalDibuat = &now
	}
	if d := parseDate(mStr(in, "tanggalRetensiBerakhir")); d != nil {
		ar.TanggalRetensiAkhir = d
	} else {
		var kk models.KodeKlasifikasi
		if err := database.DB.First(&kk, "id = ?", kelas).Error; err == nil && ar.TanggalDibuat != nil {
			ar.TanggalRetensiAkhir = models.HitungRetensiBerakhir(*ar.TanggalDibuat, &kk)
		}
	}

	if err := database.DB.Create(&ar).Error; err != nil {
		return nil, fmt.Errorf("gagal menyimpan arsip: %v", err)
	}
	a.writeActivity("tambah_arsip", "Menambah arsip "+nomor+" — "+nama, "arsip", ar.ID)
	return map[string]interface{}{"id": ar.ID, "nomor": ar.NomorArsip, "status": ar.StatusArsip}, nil
}

// UpdateArsip mengubah data arsip yang sudah ada.
func (a *App) UpdateArsip(id string, in map[string]interface{}) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	var ar models.Arsip
	if err := database.DB.First(&ar, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("arsip tidak ditemukan")
	}

	updates := map[string]interface{}{}
	if hasKey(in, "nomor") {
		updates["nomor_arsip"] = mStr(in, "nomor")
	}
	if hasKey(in, "nama") {
		if mStr(in, "nama") == "" {
			return nil, fmt.Errorf("nama arsip wajib diisi")
		}
		updates["nama_arsip"] = mStr(in, "nama")
	}
	if hasKey(in, "uraian") {
		updates["uraian"] = mStr(in, "uraian")
	}
	if hasKey(in, "status") {
		updates["status_arsip"] = mStr(in, "status")
	}
	if hasKey(in, "kodeKlasifikasiId") {
		updates["kode_klasifikasi_id"] = mStr(in, "kodeKlasifikasiId")
	}
	if hasKey(in, "unitKerjaId") {
		updates["unit_kerja_id"] = mStr(in, "unitKerjaId")
	}
	if hasKey(in, "jenisArsipId") {
		updates["jenis_arsip_id"] = strPtr(mStr(in, "jenisArsipId"))
	}
	if hasKey(in, "pemberkasanId") {
		updates["pemberkasan_id"] = strPtr(mStr(in, "pemberkasanId"))
	}
	if hasKey(in, "lokasiArsipId") {
		updates["lokasi_arsip_id"] = strPtr(mStr(in, "lokasiArsipId"))
	}
	if hasKey(in, "nomorSPM") {
		updates["nomor_spm"] = mStr(in, "nomorSPM")
	}
	if hasKey(in, "jumlah") {
		if v := mInt(in, "jumlah"); v > 0 {
			updates["jumlah"] = v
		}
	}
	if hasKey(in, "satuan") && mStr(in, "satuan") != "" {
		updates["satuan"] = mStr(in, "satuan")
	}
	if hasKey(in, "nilaiAnggaran") {
		if f := currencyFloat(in, "nilaiAnggaran"); f != 0 {
			updates["nilai_anggaran"] = f
		} else {
			updates["nilai_anggaran"] = nil
		}
	}
	if hasKey(in, "tanggalDibuat") {
		updates["tanggal_dibuat"] = parseDate(mStr(in, "tanggalDibuat"))
	}
	if hasKey(in, "tanggalRetensiBerakhir") {
		updates["tanggal_retensi_berakhir"] = parseDate(mStr(in, "tanggalRetensiBerakhir"))
	}

	if err := database.DB.Model(&models.Arsip{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("gagal mengubah arsip: %v", err)
	}
	a.writeActivity("ubah_arsip", "Mengubah arsip "+ar.NomorArsip, "arsip", id)
	return map[string]interface{}{"id": id}, nil
}

// DeleteArsip menghapus (soft delete) arsip.
func (a *App) DeleteArsip(id string) error {
	if database.DB == nil {
		return fmt.Errorf("database belum siap")
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("id arsip kosong")
	}
	var ar models.Arsip
	if err := database.DB.First(&ar, "id = ?", id).Error; err != nil {
		// Baris bisa saja sudah dihapus di perangkat lain, oleh proses
		// sinkronisasi, atau karena klik ganda. Bila arsip memang sudah
		// tidak aktif, anggap berhasil (idempoten) supaya daftar dapat
		// disegarkan tanpa pesan galat yang membingungkan.
		var ada int64
		database.DB.Unscoped().Model(&models.Arsip{}).Where("id = ?", id).Count(&ada)
		a.invalidateMasterCache()
		if ada > 0 {
			return nil
		}
		return fmt.Errorf("arsip tidak ditemukan")
	}
	if err := database.DB.Delete(&models.Arsip{}, "id = ?", id).Error; err != nil {
		// Pastikan tampilan tidak menyimpan baris lama bila penghapusan gagal.
		a.invalidateMasterCache()
		return err
	}
	a.writeActivity("hapus_arsip", "Menghapus arsip "+ar.NomorArsip, "arsip", id)
	return nil
}

// MoveArsip memindahkan satu/banyak arsip ke lokasi penyimpanan lain.
func (a *App) MoveArsip(ids []string, lokasiID string) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	if lokasiID == "" {
		return nil, fmt.Errorf("lokasi tujuan wajib dipilih")
	}
	if len(ids) == 0 {
		return nil, fmt.Errorf("pilih minimal satu arsip")
	}
	var lokasi models.LokasiArsip
	if err := database.DB.First(&lokasi, "id = ?", lokasiID).Error; err != nil {
		return nil, fmt.Errorf("lokasi tujuan tidak ditemukan")
	}
	res := database.DB.Model(&models.Arsip{}).Where("id IN ?", ids).
		Update("lokasi_arsip_id", lokasiID)
	if res.Error != nil {
		return nil, res.Error
	}
	a.writeActivity("pindah_arsip", fmt.Sprintf("Memindahkan %d arsip ke %s", res.RowsAffected, lokasi.NamaLokasi), "arsip", "")
	return map[string]interface{}{"moved": res.RowsAffected, "lokasi": lokasi.NamaLokasi}, nil
}

// ── MASTER DATA CRUD ─────────────────────────────────────────────────────────

func (a *App) SaveUnitKerja(id, nama string) (map[string]interface{}, error) {
	nama = strings.TrimSpace(nama)
	if nama == "" {
		return nil, fmt.Errorf("nama unit kerja wajib diisi")
	}
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	if id == "" {
		u := models.UnitKerja{ID: uuid.NewString(), NamaUnit: nama}
		if err := database.DB.Create(&u).Error; err != nil {
			return nil, err
		}
		a.writeActivity("tambah_unit", "Menambah unit kerja "+nama, "unit_kerja", u.ID)
		return map[string]interface{}{"id": u.ID}, nil
	}
	if err := database.DB.Model(&models.UnitKerja{}).Where("id = ?", id).Update("nama_unit", nama).Error; err != nil {
		return nil, err
	}
	a.writeActivity("ubah_unit", "Mengubah unit kerja "+nama, "unit_kerja", id)
	return map[string]interface{}{"id": id}, nil
}

func (a *App) DeleteUnitKerja(id string) error {
	if err := database.DB.Delete(&models.UnitKerja{}, "id = ?", id).Error; err != nil {
		return err
	}
	a.invalidateMasterCache()
	return nil
}

func (a *App) SaveLokasiArsip(in map[string]interface{}) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	nama := mStr(in, "nama")
	if nama == "" {
		return nil, fmt.Errorf("nama lokasi wajib diisi")
	}
	id := mStr(in, "id")
	if id == "" {
		l := models.LokasiArsip{
			ID:         uuid.NewString(),
			NamaLokasi: nama,
			Deskripsi:  mStr(in, "deskripsi"),
			Kapasitas:  strPtr(mStr(in, "kapasitas")),
			IsActive:   true,
		}
		if err := database.DB.Create(&l).Error; err != nil {
			return nil, err
		}
		a.invalidateMasterCache()
		return map[string]interface{}{"id": l.ID}, nil
	}
	updates := map[string]interface{}{
		"nama_lokasi": nama,
		"deskripsi":   mStr(in, "deskripsi"),
		"kapasitas":   strPtr(mStr(in, "kapasitas")),
	}
	if err := database.DB.Model(&models.LokasiArsip{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	a.invalidateMasterCache()
	return map[string]interface{}{"id": id}, nil
}

func (a *App) DeleteLokasiArsip(id string) error {
	if err := database.DB.Delete(&models.LokasiArsip{}, "id = ?", id).Error; err != nil {
		return err
	}
	a.invalidateMasterCache()
	return nil
}

func (a *App) SaveKodeKlasifikasi(in map[string]interface{}) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	kode := mStr(in, "kode")
	nama := mStr(in, "nama")
	if kode == "" || nama == "" {
		return nil, fmt.Errorf("kode dan nama klasifikasi wajib diisi")
	}
	id := mStr(in, "id")
	if id == "" {
		k := models.KodeKlasifikasi{
			ID:                  uuid.NewString(),
			KodeKlasifikasi:     kode,
			NamaKlasifikasi:     nama,
			RetensiAktif:        mInt(in, "retensiAktif"),
			RetensiInaktif:      mInt(in, "retensiInaktif"),
			PenyusutanArsip:     mStr(in, "penyusutanArsip"),
			KlasifikasiKeamanan: mStr(in, "klasifikasiKeamanan"),
			UnitPengolah:        mStr(in, "unitPengolah"),
			IsActive:            true,
		}
		if err := database.DB.Create(&k).Error; err != nil {
			return nil, err
		}
		a.invalidateMasterCache()
		return map[string]interface{}{"id": k.ID}, nil
	}
	updates := map[string]interface{}{
		"kode_klasifikasi":     kode,
		"nama_klasifikasi":     nama,
		"retensi_aktif":        mInt(in, "retensiAktif"),
		"retensi_inaktif":      mInt(in, "retensiInaktif"),
		"penyusutan_arsip":     mStr(in, "penyusutanArsip"),
		"klasifikasi_keamanan": mStr(in, "klasifikasiKeamanan"),
		"unit_pengolah":        mStr(in, "unitPengolah"),
	}
	if err := database.DB.Model(&models.KodeKlasifikasi{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	a.invalidateMasterCache()
	return map[string]interface{}{"id": id}, nil
}

func (a *App) DeleteKodeKlasifikasi(id string) error {
	if err := database.DB.Delete(&models.KodeKlasifikasi{}, "id = ?", id).Error; err != nil {
		return err
	}
	a.invalidateMasterCache()
	return nil
}

func (a *App) SaveJenisArsip(in map[string]interface{}) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	nama := mStr(in, "nama")
	if nama == "" {
		return nil, fmt.Errorf("nama jenis arsip wajib diisi")
	}
	id := mStr(in, "id")
	if id == "" {
		j := models.JenisArsip{
			ID:         uuid.NewString(),
			KodeJenis:  mStr(in, "kode"),
			NamaJenis:  nama,
			Keterangan: mStr(in, "keterangan"),
		}
		if err := database.DB.Create(&j).Error; err != nil {
			return nil, err
		}
		a.invalidateMasterCache()
		return map[string]interface{}{"id": j.ID}, nil
	}
	updates := map[string]interface{}{
		"kode_jenis": mStr(in, "kode"),
		"nama_jenis": nama,
		"keterangan": mStr(in, "keterangan"),
	}
	if err := database.DB.Model(&models.JenisArsip{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	a.invalidateMasterCache()
	return map[string]interface{}{"id": id}, nil
}

func (a *App) DeleteJenisArsip(id string) error {
	if err := database.DB.Delete(&models.JenisArsip{}, "id = ?", id).Error; err != nil {
		return err
	}
	a.invalidateMasterCache()
	return nil
}

func (a *App) SaveRole(in map[string]interface{}) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	name := mStr(in, "name")
	if name == "" {
		return nil, fmt.Errorf("nama role wajib diisi")
	}
	id := mStr(in, "id")
	if id == "" {
		r := models.Role{
			ID:         uuid.NewString(),
			Name:       name,
			NamaRole:   mStr(in, "namaRole"),
			Keterangan: mStr(in, "keterangan"),
		}
		if r.NamaRole == "" {
			r.NamaRole = name
		}
		if err := database.DB.Create(&r).Error; err != nil {
			return nil, err
		}
		a.invalidateMasterCache()
		return map[string]interface{}{"id": r.ID}, nil
	}
	updates := map[string]interface{}{
		"name":       name,
		"nama_role":  mStr(in, "namaRole"),
		"keterangan": mStr(in, "keterangan"),
	}
	if err := database.DB.Model(&models.Role{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	a.invalidateMasterCache()
	return map[string]interface{}{"id": id}, nil
}

func (a *App) DeleteRole(id string) error {
	if err := database.DB.Delete(&models.Role{}, "id = ?", id).Error; err != nil {
		return err
	}
	a.invalidateMasterCache()
	return nil
}

func (a *App) SaveUser(in map[string]interface{}) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	id := mStr(in, "id")
	username := mStr(in, "username")
	name := mStr(in, "name")
	if id == "" {
		if username == "" || name == "" {
			return nil, fmt.Errorf("username dan nama wajib diisi")
		}
		password := mStr(in, "password")
		if password == "" {
			password = "simarc123"
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		u := models.User{
			ID:          uuid.NewString(),
			Username:    username,
			Name:        name,
			Password:    string(hash),
			RoleID:      mStr(in, "roleId"),
			UnitKerjaID: strPtr(mStr(in, "unitKerjaId")),
			IsActive:    true,
		}
		if hasKey(in, "isActive") {
			u.IsActive = mBool(in, "isActive")
		}
		if err := database.DB.Create(&u).Error; err != nil {
			return nil, fmt.Errorf("gagal menyimpan pengguna: %v", err)
		}
		a.writeActivity("tambah_user", "Menambah pengguna "+username, "users", u.ID)
		return map[string]interface{}{"id": u.ID}, nil
	}
	updates := map[string]interface{}{
		"username": username,
		"name":     name,
	}
	if hasKey(in, "roleId") {
		updates["role_id"] = mStr(in, "roleId")
	}
	if hasKey(in, "unitKerjaId") {
		updates["unit_kerja_id"] = strPtr(mStr(in, "unitKerjaId"))
	}
	if hasKey(in, "isActive") {
		updates["is_active"] = mBool(in, "isActive")
	}
	if pw := mStr(in, "password"); pw != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		updates["password"] = string(hash)
	}
	if err := database.DB.Model(&models.User{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	a.writeActivity("ubah_user", "Mengubah pengguna "+username, "users", id)
	return map[string]interface{}{"id": id}, nil
}

func (a *App) DeleteUser(id string) error {
	if err := database.DB.Delete(&models.User{}, "id = ?", id).Error; err != nil {
		return err
	}
	a.invalidateMasterCache()
	return nil
}

// ── PEMBERKASAN ──────────────────────────────────────────────────────────────

func (a *App) SavePemberkasan(in map[string]interface{}) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	nama := mStr(in, "nama")
	if nama == "" {
		return nil, fmt.Errorf("nama berkas wajib diisi")
	}
	id := mStr(in, "id")
	tahun := mInt(in, "tahun")
	if tahun == 0 {
		tahun = time.Now().Year()
	}
	status := mStr(in, "status")
	if status == "" {
		status = "aktif"
	}
	if id == "" {
		b := models.Pemberkasan{
			ID:                uuid.NewString(),
			KodeBerkas:        mStr(in, "kode"),
			NamaPemberkasan:   nama,
			Tahun:             tahun,
			StatusBerkas:      status,
			TanggalMulai:      parseDate(mStr(in, "tanggalMulai")),
			TanggalTutup:      parseDate(mStr(in, "tanggalTutup")),
			UnitKerjaID:       strPtr(mStr(in, "unitKerjaId")),
			KodeKlasifikasiID: strPtr(mStr(in, "kodeKlasifikasiId")),
		}
		if err := database.DB.Create(&b).Error; err != nil {
			return nil, err
		}
		a.writeActivity("tambah_pemberkasan", "Menambah berkas "+nama, "pemberkasan", b.ID)
		return map[string]interface{}{"id": b.ID}, nil
	}
	updates := map[string]interface{}{
		"kode_berkas":         mStr(in, "kode"),
		"nama_pemberkasan":    nama,
		"tahun":               tahun,
		"status_berkas":       status,
		"tanggal_mulai":       parseDate(mStr(in, "tanggalMulai")),
		"tanggal_tutup":       parseDate(mStr(in, "tanggalTutup")),
		"unit_kerja_id":       strPtr(mStr(in, "unitKerjaId")),
		"kode_klasifikasi_id": strPtr(mStr(in, "kodeKlasifikasiId")),
	}
	if err := database.DB.Model(&models.Pemberkasan{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	a.invalidateMasterCache()
	return map[string]interface{}{"id": id}, nil
}

func (a *App) DeletePemberkasan(id string) error {
	if database.DB == nil {
		return fmt.Errorf("database belum siap")
	}
	database.DB.Model(&models.Arsip{}).Where("pemberkasan_id = ?", id).Update("pemberkasan_id", nil)
	if err := database.DB.Delete(&models.Pemberkasan{}, "id = ?", id).Error; err != nil {
		return err
	}
	a.invalidateMasterCache()
	return nil
}

// AssignArsipToPemberkasan memasukkan arsip terpilih ke sebuah berkas.
func (a *App) AssignArsipToPemberkasan(ids []string, pemberkasanID string) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	if pemberkasanID == "" || len(ids) == 0 {
		return nil, fmt.Errorf("pilih arsip dan berkas tujuan")
	}
	res := database.DB.Model(&models.Arsip{}).Where("id IN ?", ids).Update("pemberkasan_id", pemberkasanID)
	if res.Error != nil {
		return nil, res.Error
	}
	a.writeActivity("berkaskan_arsip", fmt.Sprintf("Memasukkan %d arsip ke berkas", res.RowsAffected), "pemberkasan", pemberkasanID)
	return map[string]interface{}{"updated": res.RowsAffected}, nil
}

// ── PEMINJAMAN ───────────────────────────────────────────────────────────────

func (a *App) UpdatePeminjamanStatus(id, status, catatan string) error {
	if database.DB == nil {
		return fmt.Errorf("database belum siap")
	}
	updates := map[string]interface{}{"status": status, "catatan": catatan}
	if status == "disetujui" || status == "approved" {
		uid := a.actingUserID()
		if uid != "" {
			updates["approved_by"] = uid
		}
	}
	if status == "dikembalikan" || status == "returned" {
		updates["tanggal_kembali_aktual"] = time.Now()
	}
	if err := database.DB.Model(&models.PeminjamanArsip{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return err
	}
	a.writeActivity("ubah_peminjaman", "Status peminjaman menjadi "+status, "peminjaman", id)
	return nil
}

// CreatePeminjamanFull membuat permohonan pinjam dengan data form lengkap.
func (a *App) CreatePeminjamanFull(in map[string]interface{}) (map[string]interface{}, error) {
	return a.CreatePeminjaman(
		mStr(in, "arsipId"),
		func() string {
			if v := mStr(in, "userId"); v != "" {
				return v
			}
			return a.actingUserID()
		}(),
		mStr(in, "keperluan"),
		mStr(in, "tanggalPinjam"),
		mStr(in, "tanggalKembaliRencana"),
	)
}

// ── PEMUSNAHAN ───────────────────────────────────────────────────────────────

func (a *App) CreatePemusnahan(ids []string, namaKegiatan, alasan string) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	if len(ids) == 0 {
		return nil, fmt.Errorf("pilih minimal satu arsip")
	}
	if strings.TrimSpace(namaKegiatan) == "" {
		namaKegiatan = "Pemusnahan Arsip"
	}
	uid := a.actingUserID()
	now := time.Now()
	created := 0
	for _, arsipID := range ids {
		var ar models.Arsip
		if err := database.DB.First(&ar, "id = ?", arsipID).Error; err != nil {
			continue
		}
		p := models.PemusnahanArsip{
			ID:                 uuid.NewString(),
			ArsipID:            &arsipID,
			NamaKegiatan:       namaKegiatan,
			AlasanPengajuan:    alasan,
			Status:             "diajukan",
			TanggalPengajuan:   &now,
			UserPengajuID:      uid,
			TanggalPelaksanaan: nil,
		}
		if err := database.DB.Create(&p).Error; err == nil {
			created++
		}
	}
	if created == 0 {
		return nil, fmt.Errorf("tidak ada arsip yang berhasil diajukan")
	}
	a.writeActivity("ajukan_pemusnahan", fmt.Sprintf("Mengajukan pemusnahan %d arsip", created), "pemusnahan", "")
	return map[string]interface{}{"created": created}, nil
}

func (a *App) UpdatePemusnahanStatus(id, status, catatan string) error {
	if database.DB == nil {
		return fmt.Errorf("database belum siap")
	}
	updates := map[string]interface{}{
		"status":             status,
		"keterangan_approve": catatan,
	}
	if status == "disetujui" || status == "approved" || status == "selesai" || status == "done" {
		now := time.Now()
		updates["tanggal_approve"] = &now
		if uid := a.actingUserID(); uid != "" {
			updates["approved_by"] = uid
		}
	}
	if status == "selesai" || status == "done" || status == "dimusnahkan" {
		var p models.PemusnahanArsip
		if err := database.DB.First(&p, "id = ?", id).Error; err == nil && p.ArsipID != nil {
			database.DB.Model(&models.Arsip{}).Where("id = ?", *p.ArsipID).Update("status_arsip", "musnah")
		}
	}
	if err := database.DB.Model(&models.PemusnahanArsip{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return err
	}
	a.writeActivity("ubah_pemusnahan", "Status pemusnahan menjadi "+status, "pemusnahan", id)
	return nil
}

// ── JADWAL RETENSI ───────────────────────────────────────────────────────────

func (a *App) ListJadwalRetensi() []map[string]interface{} {
	result := []map[string]interface{}{}
	if database.DB == nil {
		return result
	}
	var list []models.JadwalRetensi
	database.DB.Preload("KodeKlasifikasi").Preload("UnitKerja").Order("created_at desc").Find(&list)
	for _, j := range list {
		row := map[string]interface{}{
			"id":                j.ID,
			"nama":              j.NamaJadwal,
			"deskripsi":         j.Deskripsi,
			"jenis":             j.JenisJadwal,
			"status":            j.Status,
			"retensiAktif":      j.RetensiAktif,
			"retensiInaktif":    j.RetensiInaktif,
			"totalArsip":        j.TotalArsip,
			"arsipDiproses":     j.ArsipDiproses,
			"nasib":             j.Nasib,
			"catatan":           j.Catatan,
			"kodeKlasifikasiId": derefStr(j.KodeKlasifikasiID),
			"unitKerjaId":       derefStr(j.UnitKerjaID),
			"created":           j.CreatedAt.Format("2006-01-02 15:04:05"),
		}
		if j.TanggalJadwal != nil {
			row["tanggal"] = j.TanggalJadwal.Format("2006-01-02")
		}
		if j.KodeKlasifikasi != nil {
			row["kodeKlasifikasi"] = j.KodeKlasifikasi.KodeKlasifikasi + " - " + j.KodeKlasifikasi.NamaKlasifikasi
		}
		if j.UnitKerja != nil {
			row["unitKerja"] = j.UnitKerja.NamaUnit
		}
		result = append(result, row)
	}
	return result
}

func (a *App) SaveJadwalRetensi(in map[string]interface{}) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	nama := mStr(in, "nama")
	if nama == "" {
		return nil, fmt.Errorf("nama jadwal wajib diisi")
	}
	id := mStr(in, "id")
	status := mStr(in, "status")
	if status == "" {
		status = "draft"
	}
	jenis := mStr(in, "jenis")
	if jenis == "" {
		jenis = "retensi"
	}
	if id == "" {
		j := models.JadwalRetensi{
			ID:                 uuid.NewString(),
			NamaJadwal:         nama,
			Deskripsi:          mStr(in, "deskripsi"),
			TanggalJadwal:      parseDate(mStr(in, "tanggal")),
			JenisJadwal:        jenis,
			Status:             status,
			KodeKlasifikasiID:  strPtr(mStr(in, "kodeKlasifikasiId")),
			UnitKerjaID:        strPtr(mStr(in, "unitKerjaId")),
			RetensiAktif:       mInt(in, "retensiAktif"),
			RetensiInaktif:     mInt(in, "retensiInaktif"),
			Nasib:              mStr(in, "nasib"),
			Catatan:            mStr(in, "catatan"),
			TanggalPelaksanaan: parseDate(mStr(in, "tanggal")),
		}
		if err := database.DB.Create(&j).Error; err != nil {
			return nil, err
		}
		a.writeActivity("tambah_jadwal", "Menambah jadwal retensi "+nama, "jadwal_retensi", j.ID)
		return map[string]interface{}{"id": j.ID}, nil
	}
	updates := map[string]interface{}{
		"nama_jadwal":         nama,
		"deskripsi":           mStr(in, "deskripsi"),
		"tanggal_jadwal":      parseDate(mStr(in, "tanggal")),
		"jenis_jadwal":        jenis,
		"status":              status,
		"kode_klasifikasi_id": strPtr(mStr(in, "kodeKlasifikasiId")),
		"unit_kerja_id":       strPtr(mStr(in, "unitKerjaId")),
		"retensi_aktif":       mInt(in, "retensiAktif"),
		"retensi_inaktif":     mInt(in, "retensiInaktif"),
		"nasib":               mStr(in, "nasib"),
		"catatan":             mStr(in, "catatan"),
	}
	if err := database.DB.Model(&models.JadwalRetensi{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	return map[string]interface{}{"id": id}, nil
}

func (a *App) DeleteJadwalRetensi(id string) error {
	return database.DB.Delete(&models.JadwalRetensi{}, "id = ?", id).Error
}

// ProsesJadwalRetensi menandai arsip yang memenuhi kriteria jadwal.
func (a *App) ProsesJadwalRetensi(id string) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	var j models.JadwalRetensi
	if err := database.DB.First(&j, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("jadwal tidak ditemukan")
	}
	q := database.DB.Model(&models.Arsip{}).Where("deleted_at IS NULL")
	if j.KodeKlasifikasiID != nil && *j.KodeKlasifikasiID != "" {
		q = q.Where("kode_klasifikasi_id = ?", *j.KodeKlasifikasiID)
	}
	if j.UnitKerjaID != nil && *j.UnitKerjaID != "" {
		q = q.Where("unit_kerja_id = ?", *j.UnitKerjaID)
	}
	var total int64
	q.Count(&total)
	status := "siap_penyusutan"
	nasib := strings.ToLower(j.Nasib)
	if strings.Contains(nasib, "musnah") || strings.Contains(nasib, "destroy") {
		status = "musnah"
	} else if strings.Contains(nasib, "permanen") || strings.Contains(nasib, "permanent") {
		status = "permanen"
	}
	res := q.Update("status_arsip", status)
	if res.Error != nil {
		return nil, res.Error
	}
	database.DB.Model(&models.JadwalRetensi{}).Where("id = ?", id).Updates(map[string]interface{}{
		"total_arsip":    total,
		"arsip_diproses": res.RowsAffected,
		"status":         "selesai",
	})
	a.writeActivity("proses_jadwal", fmt.Sprintf("Memproses jadwal retensi: %d arsip", res.RowsAffected), "jadwal_retensi", id)
	return map[string]interface{}{"total": total, "processed": res.RowsAffected, "status": status}, nil
}

// ── PENGATURAN ───────────────────────────────────────────────────────────────

func (a *App) GetSettings() map[string]interface{} {
	off := config.LoadOffsite()
	ds := config.LoadDigitalStorage()
	return map[string]interface{}{
		"appName":             config.App.AppName,
		"timezone":            config.App.AppTimezone,
		"debug":               config.App.AppDebug,
		"window":              os.Getenv("SIMARC_WINDOW"),
		"dbHost":              config.App.DBHost,
		"dbPort":              config.App.DBPort,
		"dbName":              config.App.DBName,
		"dbUser":              config.App.DBUser,
		"dbTLS":               config.App.DBTLS,
		"dbDriver":            config.App.DBDriver,
		"dbPath":              config.App.DBPath,
		"dbPasswordSet":       config.App.DBPass != "",
		"databaseUrlSet":      os.Getenv("DATABASE_URL") != "",
		"institution":         config.App.AppInstitution,
		"institutionSub":      config.App.AppInstitutionSub,
		"address":             config.App.AppAddress,
		"phone":               config.App.AppPhone,
		"fax":                 config.App.AppFax,
		"email":               config.App.AppEmail,
		"web":                 config.App.AppWeb,
		"sessionKeySet":       config.App.SessionKey != "",
		"googleDriveClientID": config.App.GoogleDriveClientID,
		"googleDriveFolderID": config.App.GoogleDriveFolderID,
		"syncEnabled":         os.Getenv("SYNC_ENABLED") == "true",
		"syncNodeId":          os.Getenv("SYNC_NODE_ID"),
		"syncInterval":        os.Getenv("SYNC_INTERVAL_MINUTES"),
		"syncHubUrl":          os.Getenv("SYNC_HUB_URL"),
		"syncHubTokenSet":     os.Getenv("SYNC_HUB_TOKEN") != "",
		"offsiteEnabled":      off.Enabled,
		"offsiteHour":         off.Hour,
		"offsiteMinute":       off.Minute,
		"offsiteDbHost":       off.DBHost,
		"offsiteDbPort":       off.DBPort,
		"offsiteDbName":       off.DBName,
		"offsiteDbUser":       off.DBUser,
		"offsiteDbTls":        off.DBTLS,
		"offsiteDbPassSet":    off.DBPass != "",
		"offsiteS3Endpoint":   off.S3Endpoint,
		"offsiteS3Region":     off.S3Region,
		"offsiteS3Bucket":     off.S3Bucket,
		"offsiteS3AccessKey":  off.S3AccessKey,
		"offsiteS3SecretSet":  off.S3SecretKey != "",
		"offsiteS3Prefix":     off.S3Prefix,
		"offsiteS3PathStyle":  off.S3PathStyle,
		"offsiteS3Ready":      off.S3Ready(),
		"digitalStorage":      ds.Mode,
		"digitalCloudReady":   ds.DigitalCloudReady(),
		"digitalS3Configured": ds.S3.S3Ready(),
		"digitalRcloneRemote": ds.RcloneRemote,
		"digitalRclonePath":   ds.RclonePath,
		"digitalRcloneReady":  ds.RcloneConfigured() && services.RcloneAvailable(),
		"digitalBackend":      digitalBackendLabel(),
		"envFile":             absEnvPath(),
	}
}

func absEnvPath() string {
	path := config.EnvFilePath()
	if abs, err := filepath.Abs(path); err == nil {
		return abs
	}
	return path
}

// digitalBackendLabel mengembalikan backend penyimpanan digital yang aktif
// dalam bentuk yang mudah dibaca pada antarmuka.
func digitalBackendLabel() string {
	b, err := services.DigitalBackendName()
	if err != nil {
		return "belum siap"
	}
	switch b {
	case "s3":
		return "cloud S3"
	case "rclone":
		ds := config.LoadDigitalStorage()
		return "rclone (" + ds.RcloneRemote + ")"
	default:
		return "lokal"
	}
}

// SaveSettings menulis pengaturan yang diizinkan ke .env dan memperbarui
// konfigurasi runtime. Perubahan koneksi database baru aktif setelah restart.
func (a *App) SaveSettings(updates map[string]interface{}) (map[string]interface{}, error) {
	allowed := map[string]bool{
		"APP_NAME": true, "APP_TIMEZONE": true, "APP_DEBUG": true, "SIMARC_WINDOW": true,
		"DB_HOST": true, "DB_PORT": true, "DB_DATABASE": true, "DB_USERNAME": true,
		"DB_PASSWORD": true, "DB_TLS": true, "DB_DRIVER": true, "DB_PATH": true,
		"DATABASE_URL": true, "SESSION_KEY": true,
		"APP_INSTITUTION": true, "APP_INSTITUTION_SUB": true, "APP_ADDRESS": true,
		"APP_PHONE": true, "APP_FAX": true, "APP_EMAIL": true, "APP_WEB": true,
		"GOOGLE_DRIVE_CLIENT_ID": true, "GOOGLE_DRIVE_FOLDER_ID": true,
		"SYNC_ENABLED": true, "SYNC_NODE_ID": true, "SYNC_INTERVAL_MINUTES": true,
		"SYNC_HUB_URL": true, "SYNC_HUB_TOKEN": true,
		"SYNC_HUB_DB_HOST": true, "SYNC_HUB_DB_PORT": true, "SYNC_HUB_DB_NAME": true,
		"SYNC_HUB_DB_USER": true, "SYNC_HUB_DB_PASS": true, "SYNC_HUB_DB_TLS": true,
		"OFFSITE_ENABLED": true, "OFFSITE_HOUR": true, "OFFSITE_MINUTE": true,
		"OFFSITE_DB_HOST": true, "OFFSITE_DB_PORT": true, "OFFSITE_DB_NAME": true,
		"OFFSITE_DB_USER": true, "OFFSITE_DB_PASS": true, "OFFSITE_DB_TLS": true,
		"OFFSITE_S3_ENDPOINT": true, "OFFSITE_S3_REGION": true, "OFFSITE_S3_BUCKET": true,
		"OFFSITE_S3_ACCESS_KEY": true, "OFFSITE_S3_SECRET_KEY": true, "OFFSITE_S3_PREFIX": true,
		"OFFSITE_S3_PATH_STYLE": true,
		"DIGITAL_STORAGE": true,
		"DIGITAL_S3_ENDPOINT": true, "DIGITAL_S3_REGION": true, "DIGITAL_S3_BUCKET": true,
		"DIGITAL_S3_ACCESS_KEY": true, "DIGITAL_S3_SECRET_KEY": true, "DIGITAL_S3_PREFIX": true,
		"DIGITAL_S3_PATH_STYLE": true,
		"DIGITAL_RCLONE_REMOTE": true, "DIGITAL_RCLONE_PATH": true,
	}
	env := map[string]string{}
	for k, v := range updates {
		key := strings.ToUpper(strings.TrimSpace(k))
		if !allowed[key] {
			continue
		}
		if s, ok := v.(string); ok {
			env[key] = s
		} else if v != nil {
			env[key] = fmt.Sprint(v)
		}
	}
	if err := config.UpdateEnv(env); err != nil {
		return nil, fmt.Errorf("gagal menyimpan pengaturan: %v", err)
	}
	// Muat ulang nilai runtime (tanpa reconnect DB).
	config.Load()
	return map[string]interface{}{"saved": len(env), "envFile": absEnvPath(), "restartRequired": true}, nil
}

// ── SINKRONISASI ─────────────────────────────────────────────────────────────

func (a *App) GetSyncStatus() map[string]interface{} {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	st := syncdb.Mgr.Status(ctx)
	return map[string]interface{}{
		"enabled":         st.Enabled,
		"ready":           st.Ready,
		"nodeId":          st.NodeID,
		"hubHost":         st.HubHost,
		"hubDatabase":     st.HubDatabase,
		"intervalMinutes": st.IntervalMinutes,
		"running":         st.Running,
		"pendingChanges":  st.PendingChanges,
	}
}

func (a *App) RunSyncNow() (map[string]interface{}, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	res, err := syncdb.Mgr.RunNow(ctx)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"pushed": res.Pushed,
		"pulled": res.Pulled,
		"errors": res.Errors,
		"status": res.Status(),
	}, nil
}

// ── BACKUP & RESTORE ─────────────────────────────────────────────────────────

func (a *App) ListBackupLogs() []map[string]interface{} {
	result := []map[string]interface{}{}
	if database.DB == nil {
		return result
	}
	var logs []models.BackupLog
	database.DB.Order("created_at desc").Limit(100).Find(&logs)
	for _, b := range logs {
		result = append(result, map[string]interface{}{
			"id":       b.ID,
			"fileName": b.FileName,
			"filePath": b.FilePath,
			"fileSize": b.FileSize,
			"size":     b.SizeFormatted(),
			"type":     b.BackupType,
			"status":   b.Status,
			"provider": b.CloudProvider,
			"notes":    b.Notes,
			"created":  b.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}
	return result
}

// CreateBackup membuat dump SQL lalu meminta pengguna memilih lokasi simpan.
func (a *App) CreateBackup() (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	data, err := services.ExportDatabaseAsSQL()
	if err != nil {
		return nil, err
	}
	name := fmt.Sprintf("simarc_backup_%s.sql", time.Now().Format("2006-01-02_150405"))
	path, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:           "Simpan Backup Database SIMARC",
		DefaultFilename: name,
		Filters:         []wailsruntime.FileFilter{{DisplayName: "SQL (*.sql)", Pattern: "*.sql"}},
	})
	if err != nil {
		return nil, err
	}
	if path == "" {
		return map[string]interface{}{"cancelled": true}, nil
	}
	if err := os.WriteFile(path, data, 0600); err != nil {
		return nil, err
	}
	now := time.Now()
	_ = database.DB.Create(&models.BackupLog{
		ID:          uuid.NewString(),
		FileName:    filepath.Base(path),
		FilePath:    path,
		FileSize:    int64(len(data)),
		BackupType:  "database",
		Status:      "success",
		CompletedAt: &now,
		Notes:       "Backup manual dari menu Backup & Restore",
	}).Error
	a.writeActivity("backup_database", "Membuat backup database: "+filepath.Base(path), "backup", "")
	return map[string]interface{}{"path": path, "size": len(data)}, nil
}

// RestoreBackup memulihkan database dari file .sql yang dipilih pengguna.
func (a *App) RestoreBackup() (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:   "Pilih file backup SQL",
		Filters: []wailsruntime.FileFilter{{DisplayName: "SQL (*.sql)", Pattern: "*.sql"}},
	})
	if err != nil {
		return nil, err
	}
	if path == "" {
		return map[string]interface{}{"cancelled": true}, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	cfg := mysqlDriver.NewConfig()
	cfg.User = config.App.DBUser
	cfg.Passwd = config.App.DBPass
	cfg.Net = "tcp"
	cfg.Addr = config.App.DBHost + ":" + config.App.DBPort
	cfg.DBName = config.App.DBName
	cfg.ParseTime = true
	cfg.MultiStatements = true
	if mode := config.NormalizeMySQLTLS(config.App.DBTLS); mode != "" {
		cfg.TLSConfig = mode
	}
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return nil, err
	}
	defer db.Close()
	if _, err := db.Exec(string(data)); err != nil {
		return nil, fmt.Errorf("restore gagal: %v", err)
	}
	a.writeActivity("restore_database", "Restore database dari "+filepath.Base(path), "backup", "")
	return map[string]interface{}{"path": path, "size": len(data), "restartRequired": true}, nil
}

// ── IMPORT / EXPORT CSV ──────────────────────────────────────────────────────

func (a *App) ExportArsipCSV() (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	path, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:           "Export Data Arsip (CSV)",
		DefaultFilename: fmt.Sprintf("arsip_%s.csv", time.Now().Format("20060102")),
		Filters:         []wailsruntime.FileFilter{{DisplayName: "CSV (*.csv)", Pattern: "*.csv"}},
	})
	if err != nil {
		return nil, err
	}
	if path == "" {
		return map[string]interface{}{"cancelled": true}, nil
	}
	rows := a.ListArsipDetail()
	f, err := os.Create(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	w := csv.NewWriter(f)
	_ = w.Write([]string{"nomor", "nama", "uraian", "status", "kode_klasifikasi", "unit_kerja", "kategori", "lokasi", "tanggal", "jumlah", "satuan", "nilai", "nomor_spm"})
	for _, r := range rows {
		_ = w.Write([]string{
			fmt.Sprint(r["nomor"]), fmt.Sprint(r["nama"]), fmt.Sprint(r["uraian"]),
			fmt.Sprint(r["status"]), fmt.Sprint(r["kodeKlasifikasiTxt"]), fmt.Sprint(r["unit"]),
			fmt.Sprint(r["kategori"]), fmt.Sprint(r["lokasi"]), fmt.Sprint(r["tanggal"]),
			fmt.Sprint(r["jumlah"]), fmt.Sprint(r["satuan"]), fmt.Sprint(r["nilai"]), fmt.Sprint(r["nomor_spm"]),
		})
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return nil, err
	}
	a.writeActivity("export_arsip", "Export arsip ke CSV: "+filepath.Base(path), "arsip", "")
	return map[string]interface{}{"path": path, "rows": len(rows)}, nil
}

func (a *App) ImportArsipCSV() (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:   "Pilih file CSV arsip",
		Filters: []wailsruntime.FileFilter{{DisplayName: "CSV (*.csv)", Pattern: "*.csv"}},
	})
	if err != nil {
		return nil, err
	}
	if path == "" {
		return map[string]interface{}{"cancelled": true}, nil
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	records, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("gagal membaca CSV: %v", err)
	}
	if len(records) < 2 {
		return nil, fmt.Errorf("file CSV kosong")
	}
	header := map[string]int{}
	for i, h := range records[0] {
		header[strings.ToLower(strings.TrimSpace(h))] = i
	}
	get := func(row []string, key string) string {
		if i, ok := header[key]; ok && i < len(row) {
			return strings.TrimSpace(row[i])
		}
		return ""
	}
	imported, skipped := 0, 0
	errs := []string{}
	for line, row := range records[1:] {
		nama := get(row, "nama")
		if nama == "" {
			skipped++
			continue
		}
		kelasID := a.resolveKodeKlasifikasi(get(row, "kode_klasifikasi"))
		unitID := a.resolveUnitKerja(get(row, "unit_kerja"))
		if kelasID == "" || unitID == "" {
			skipped++
			errs = append(errs, fmt.Sprintf("baris %d: kode klasifikasi/unit kerja tidak ditemukan", line+2))
			continue
		}
		in := map[string]interface{}{
			"nomor": get(row, "nomor"), "nama": nama, "uraian": get(row, "uraian"),
			"status": get(row, "status"), "kodeKlasifikasiId": kelasID, "unitKerjaId": unitID,
			"lokasiArsipId": a.resolveLokasi(get(row, "lokasi")),
			"jenisArsipId":  a.resolveJenis(get(row, "kategori")),
			"tanggalDibuat": get(row, "tanggal"), "jumlah": get(row, "jumlah"),
			"satuan": get(row, "satuan"), "nilaiAnggaran": get(row, "nilai"),
			"nomorSPM": get(row, "nomor_spm"),
		}
		if _, err := a.CreateArsipFull(in); err != nil {
			skipped++
			errs = append(errs, fmt.Sprintf("baris %d: %v", line+2, err))
			continue
		}
		imported++
	}
	a.writeActivity("import_arsip", fmt.Sprintf("Import CSV: %d arsip masuk, %d dilewati", imported, skipped), "arsip", "")
	out := map[string]interface{}{"imported": imported, "skipped": skipped, "errors": errs}
	if len(errs) > 20 {
		out["errors"] = errs[:20]
	}
	return out, nil
}

func (a *App) resolveKodeKlasifikasi(v string) string {
	v = strings.TrimSpace(v)
	if v == "" || database.DB == nil {
		return ""
	}
	var k models.KodeKlasifikasi
	if err := database.DB.Where("kode_klasifikasi = ?", v).First(&k).Error; err == nil {
		return k.ID
	}
	if err := database.DB.Where("nama_klasifikasi = ?", v).First(&k).Error; err == nil {
		return k.ID
	}
	if err := database.DB.Where("id = ?", v).First(&k).Error; err == nil {
		return k.ID
	}
	return ""
}

func (a *App) resolveUnitKerja(v string) string {
	v = strings.TrimSpace(v)
	if v == "" || database.DB == nil {
		return ""
	}
	var u models.UnitKerja
	if err := database.DB.Where("nama_unit = ?", v).First(&u).Error; err == nil {
		return u.ID
	}
	if err := database.DB.Where("id = ?", v).First(&u).Error; err == nil {
		return u.ID
	}
	return ""
}

func (a *App) resolveLokasi(v string) string {
	v = strings.TrimSpace(v)
	if v == "" || database.DB == nil {
		return ""
	}
	var l models.LokasiArsip
	if err := database.DB.Where("nama_lokasi = ?", v).First(&l).Error; err == nil {
		return l.ID
	}
	if err := database.DB.Where("id = ?", v).First(&l).Error; err == nil {
		return l.ID
	}
	return ""
}

func (a *App) resolveJenis(v string) string {
	v = strings.TrimSpace(v)
	if v == "" || database.DB == nil {
		return ""
	}
	var j models.JenisArsip
	if err := database.DB.Where("nama_jenis = ?", v).First(&j).Error; err == nil {
		return j.ID
	}
	if err := database.DB.Where("id = ?", v).First(&j).Error; err == nil {
		return j.ID
	}
	return ""
}

// ── QR CODE ──────────────────────────────────────────────────────────────────

func (a *App) GenerateQrDataURL(text string, size int) (string, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return "", fmt.Errorf("teks QR kosong")
	}
	if size < 80 || size > 600 {
		size = 220
	}
	png, err := qrcode.Encode(text, qrcode.Medium, size)
	if err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(png), nil
}

// ExtractOcrFromFile memilih berkas gambar lalu mengekstrak teksnya dengan
// tesseract (OCR). Hasil juga dicatat ke tabel ocr_logs.
func (a *App) ExtractOcrFromFile() (map[string]interface{}, error) {
	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Pilih gambar untuk OCR",
		Filters: []wailsruntime.FileFilter{{
			DisplayName: "Gambar (*.png;*.jpg;*.jpeg;*.tif;*.tiff;*.bmp)",
			Pattern:     "*.png;*.jpg;*.jpeg;*.tif;*.tiff;*.bmp",
		}},
	})
	if err != nil {
		return nil, err
	}
	if path == "" {
		return map[string]interface{}{"cancelled": true}, nil
	}
	svc := &services.OcrService{}
	text, err := svc.ExtractText(path, "ind+eng")
	if err != nil {
		return nil, err
	}
	if database.DB != nil {
		_ = database.DB.Create(&models.OcrLog{
			FileName:      filepath.Base(path),
			Status:        "success",
			ExtractedText: text,
		}).Error
	}
	a.writeActivity("ocr", "OCR berkas "+filepath.Base(path), "ocr", "")
	return map[string]interface{}{
		"file":    filepath.Base(path),
		"text":    text,
		"chars":   len(text),
		"words":   len(strings.Fields(text)),
		"success": true,
	}, nil
}

// ── PROFIL ───────────────────────────────────────────────────────────────────

func (a *App) UpdateProfile(name string) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("nama wajib diisi")
	}
	uid := a.actingUserID()
	if uid == "" {
		return nil, fmt.Errorf("tidak ada pengguna aktif")
	}
	if err := database.DB.Model(&models.User{}).Where("id = ?", uid).Update("name", name).Error; err != nil {
		return nil, err
	}
	if a.currentProfile != nil {
		a.currentProfile["name"] = name
	}
	a.writeActivity("ubah_profil", "Memperbarui nama profil", "users", uid)
	return a.GetProfile(), nil
}

func (a *App) ChangePassword(oldPassword, newPassword string) error {
	if database.DB == nil {
		return fmt.Errorf("database belum siap")
	}
	if len(newPassword) < 6 {
		return fmt.Errorf("password baru minimal 6 karakter")
	}
	uid := a.actingUserID()
	if uid == "" {
		return fmt.Errorf("tidak ada pengguna aktif")
	}
	var u models.User
	if err := database.DB.First(&u, "id = ?", uid).Error; err != nil {
		return fmt.Errorf("pengguna tidak ditemukan")
	}
	if bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(oldPassword)) != nil {
		return fmt.Errorf("password lama salah")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return database.DB.Model(&models.User{}).Where("id = ?", uid).Update("password", string(hash)).Error
}

// ── DASHBOARD / LAPORAN HELPER ───────────────────────────────────────────────

// GetArsipWindowStats dipakai halaman laporan untuk ringkasan cepat.
func (a *App) GetArsipWindowStats() map[string]interface{} {
	out := map[string]interface{}{}
	if database.DB == nil {
		return out
	}
	var total, digital, aktif, inaktif, musnah int64
	db := database.DB
	db.Model(&models.Arsip{}).Count(&total)
	db.Model(&models.Arsip{}).Where("file_path IS NOT NULL AND file_path <> ''").Count(&digital)
	db.Model(&models.Arsip{}).Where("status_arsip = ?", "aktif").Count(&aktif)
	db.Model(&models.Arsip{}).Where("status_arsip = ?", "inaktif").Count(&inaktif)
	db.Model(&models.Arsip{}).Where("status_arsip = ?", "musnah").Count(&musnah)
	out["total"] = total
	out["digital"] = digital
	out["aktif"] = aktif
	out["inaktif"] = inaktif
	out["musnah"] = musnah
	return out
}

// QueryArsipLaporan mengembalikan baris laporan dengan filter sederhana.
func (a *App) QueryArsipLaporan(unitID, kodeID, lokasiID, status string) []map[string]interface{} {
	rows := a.ListArsipDetail()
	out := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		if unitID != "" && fmt.Sprint(r["unitId"]) != unitID {
			continue
		}
		if kodeID != "" && fmt.Sprint(r["kodeKlasifikasiId"]) != kodeID {
			continue
		}
		if lokasiID != "" && fmt.Sprint(r["lokasi"]) != lokasiID {
			continue
		}
		if status != "" && fmt.Sprint(r["status"]) != status {
			continue
		}
		out = append(out, r)
	}
	return out
}

// digitalArsipDir mengembalikan folder penyimpanan berkas digital arsip.
func digitalArsipDir() string {
	home, _ := os.UserHomeDir()
	if home == "" {
		home = "."
	}
	return filepath.Join(home, ".local", "share", "simarc", "digital")
}

// storeDigitalFile menyimpan berkas digital arsip pada backend aktif:
// object storage S3-compatible, remote rclone (mis. Google Drive), atau disk
// perangkat. Referensi cloud yang dicatat pada file_path berbentuk
// s3://bucket/key atau rclone://remote/path.
func storeDigitalFile(arsipID, filename string, data []byte) (string, error) {
	filename = filepath.Base(filename)
	if filename == "" || filename == "." {
		filename = "berkas-digital"
	}
	backend, err := services.DigitalBackendName()
	if err != nil {
		return "", err
	}
	if backend != "local" {
		return services.SaveDigitalToCloud(arsipID, filename, data)
	}
	dir := filepath.Join(digitalArsipDir(), arsipID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("gagal membuat folder digital: %v", err)
	}
	dst := filepath.Join(dir, filename)
	if err := os.WriteFile(dst, data, 0644); err != nil {
		return "", fmt.Errorf("gagal menyimpan berkas: %v", err)
	}
	return dst, nil
}

// removeDigitalFile menghapus berkas digital, baik di disk maupun di cloud.
func removeDigitalFile(ref string) {
	if strings.TrimSpace(ref) == "" {
		return
	}
	if services.IsCloudDigitalRef(ref) {
		if err := services.DeleteDigitalCloudAny(ref); err != nil {
			fmt.Fprintf(os.Stderr, "[simarc] gagal menghapus berkas cloud: %v\n", err)
		}
		return
	}
	_ = os.Remove(ref)
}

// openDigitalFile membuka berkas digital. Untuk berkas cloud, objek diunduh
// dulu ke folder sementara lalu dibuka dengan aplikasi default OS.
func openDigitalFile(ref string) (string, error) {
	local := ref
	if services.IsCloudDigitalRef(ref) {
		p, err := services.FetchDigitalCloudAny(ref)
		if err != nil {
			return "", err
		}
		local = p
	}
	if _, err := os.Stat(local); err != nil {
		return "", fmt.Errorf("berkas digital tidak ditemukan")
	}
	if err := openLocalPath(local); err != nil {
		return "", err
	}
	return local, nil
}

// openLocalPath membuka path dengan aplikasi default sesuai sistem operasi.
func openLocalPath(p string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", p).Start()
	case "darwin":
		return exec.Command("open", p).Start()
	default:
		return exec.Command("xdg-open", p).Start()
	}
}

// UploadArsipDigital membuka dialog pilih berkas, menyalinnya ke folder digital,
// dan menyimpan path-nya pada arsip terkait.
func (a *App) UploadArsipDigital(arsipId string) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	arsipId = strings.TrimSpace(arsipId)
	if arsipId == "" {
		return nil, fmt.Errorf("id arsip kosong")
	}
	var ar models.Arsip
	if err := database.DB.First(&ar, "id = ?", arsipId).Error; err != nil {
		return nil, fmt.Errorf("arsip tidak ditemukan")
	}
	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Pilih berkas digital arsip",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "Semua berkas (*.*)", Pattern: "*.*"},
			{DisplayName: "PDF (*.pdf)", Pattern: "*.pdf"},
			{DisplayName: "Gambar (*.png;*.jpg;*.jpeg)", Pattern: "*.png;*.jpg;*.jpeg"},
		},
	})
	if err != nil {
		return nil, err
	}
	if path == "" {
		return map[string]interface{}{"cancelled": true}, nil
	}
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("berkas tidak dapat dibaca: %v", err)
	}
	name := filepath.Base(path)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("gagal membaca berkas: %v", err)
	}
	dst, err := storeDigitalFile(arsipId, name, data)
	if err != nil {
		return nil, err
	}
	database.DB.Model(&models.Arsip{}).Where("id = ?", arsipId).Update("file_path", dst)
	a.invalidateMasterCache()
	a.writeActivity("upload_digital", "Upload berkas digital: "+name, "arsip", arsipId)
	return map[string]interface{}{
		"path":     dst,
		"filename": name,
		"size":     info.Size(),
	}, nil
}

// UploadArsipDigitalData menerima berkas digital (base64) dari form Tambah/Ubah
// arsip, menyimpannya ke folder digital, dan mencatat path-nya pada arsip.
func (a *App) UploadArsipDigitalData(arsipId, filename, dataBase64 string) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	arsipId = strings.TrimSpace(arsipId)
	if arsipId == "" {
		return nil, fmt.Errorf("id arsip kosong")
	}
	var ar models.Arsip
	if err := database.DB.First(&ar, "id = ?", arsipId).Error; err != nil {
		return nil, fmt.Errorf("arsip tidak ditemukan")
	}
	dataBase64 = strings.TrimSpace(dataBase64)
	if dataBase64 == "" {
		return map[string]interface{}{"cancelled": true}, nil
	}
	// Buang prefix data URL bila ada.
	if idx := strings.Index(dataBase64, ","); idx >= 0 && strings.HasPrefix(dataBase64, "data:") {
		dataBase64 = dataBase64[idx+1:]
	}
	raw, err := base64.StdEncoding.DecodeString(dataBase64)
	if err != nil {
		return nil, fmt.Errorf("data berkas tidak valid: %v", err)
	}
	if filename == "" {
		filename = "berkas-digital"
	}
	filename = filepath.Base(filename)
	dst, err := storeDigitalFile(arsipId, filename, raw)
	if err != nil {
		return nil, err
	}
	database.DB.Model(&models.Arsip{}).Where("id = ?", arsipId).Update("file_path", dst)
	a.invalidateMasterCache()
	a.writeActivity("upload_digital", "Upload berkas digital: "+filename, "arsip", arsipId)
	return map[string]interface{}{"path": dst, "filename": filename, "size": len(raw)}, nil
}

// OpenArsipDigital membuka berkas digital arsip dengan aplikasi default OS.
func (a *App) OpenArsipDigital(arsipId string) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	arsipId = strings.TrimSpace(arsipId)
	var ar models.Arsip
	if err := database.DB.First(&ar, "id = ?", arsipId).Error; err != nil {
		return nil, fmt.Errorf("arsip tidak ditemukan")
	}
	if strings.TrimSpace(ar.FilePath) == "" {
		return nil, fmt.Errorf("arsip belum memiliki berkas digital")
	}
	local, err := openDigitalFile(ar.FilePath)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"path": local, "filename": filepath.Base(local)}, nil
}

// DeleteArsipDigital menghapus berkas digital arsip dari disk dan database.
func (a *App) DeleteArsipDigital(arsipId string) (map[string]interface{}, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database belum siap")
	}
	arsipId = strings.TrimSpace(arsipId)
	var ar models.Arsip
	if err := database.DB.First(&ar, "id = ?", arsipId).Error; err != nil {
		return nil, fmt.Errorf("arsip tidak ditemukan")
	}
	if strings.TrimSpace(ar.FilePath) != "" {
		removeDigitalFile(ar.FilePath)
	}
	database.DB.Model(&models.Arsip{}).Where("id = ?", arsipId).Update("file_path", "")
	a.invalidateMasterCache()
	a.writeActivity("delete_digital", "Hapus berkas digital arsip", "arsip", arsipId)
	return map[string]interface{}{"success": true}, nil
}

// pastikan import gorm tetap dipakai walau build tag berubah.
var _ = gorm.ErrRecordNotFound
var _ = syncdb.ErrBusy
