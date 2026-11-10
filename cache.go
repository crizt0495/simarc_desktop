package main

import "time"

// Cache baca in-memory untuk data master yang mahal diambil dari TiDB Cloud.
//
// Tanpa cache, setiap navigasi halaman memanggil ListArsipDetail (≈4.200 arsip
// + relasi) dan/atau GetMasterOptions (≈3.900 kode klasifikasi) — masing-masing
// 2–8 detik karena latensi cloud. Dengan cache, panggilan berikutnya instan.
//
// Cache diinvalidasi otomatis pada setiap operasi tulis (writeActivity dan
// seluruh Save*/Delete*), sehingga data yang ditampilkan selalu segar.
const masterCacheTTL = 10 * time.Minute

// getArsipCache mengembalikan salinan cache arsip bila masih segar.
func (a *App) getArsipCache() ([]map[string]interface{}, bool) {
	a.cacheMu.RLock()
	defer a.cacheMu.RUnlock()
	if len(a.arsipCache) == 0 || time.Since(a.arsipCacheAt) > masterCacheTTL {
		return nil, false
	}
	return a.arsipCache, true
}

// setArsipCache menyimpan hasil ListArsipDetail. Hasil kosong tidak di-cache
// agar database yang belum siap tidak "terkunci" kosong.
func (a *App) setArsipCache(rows []map[string]interface{}) {
	if len(rows) == 0 {
		return
	}
	a.cacheMu.Lock()
	a.arsipCache = rows
	a.arsipCacheAt = time.Now()
	a.cacheMu.Unlock()
}

// getOptsCache mengembalikan cache opsi master bila masih segar.
func (a *App) getOptsCache() (map[string][]map[string]interface{}, bool) {
	a.cacheMu.RLock()
	defer a.cacheMu.RUnlock()
	if len(a.optsCache) == 0 || time.Since(a.optsCacheAt) > masterCacheTTL {
		return nil, false
	}
	return a.optsCache, true
}

// setOptsCache menyimpan hasil GetMasterOptions.
func (a *App) setOptsCache(opts map[string][]map[string]interface{}) {
	if len(opts) == 0 {
		return
	}
	a.cacheMu.Lock()
	a.optsCache = opts
	a.optsCacheAt = time.Now()
	a.cacheMu.Unlock()
}

// invalidateMasterCache membuang seluruh cache baca. Dipanggil setelah ada
// perubahan data agar tampilan langsung mencerminkan kondisi terbaru.
func (a *App) invalidateMasterCache() {
	a.cacheMu.Lock()
	a.arsipCache = nil
	a.arsipCacheAt = time.Time{}
	a.optsCache = nil
	a.optsCacheAt = time.Time{}
	a.cacheMu.Unlock()
}
