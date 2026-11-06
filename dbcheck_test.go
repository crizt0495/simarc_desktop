package main

import (
	"testing"

	"arsippro/internal/config"
	"arsippro/internal/database"
	"arsippro/internal/models"
)

func TestDBCheck(t *testing.T) {
	config.Load()
	if err := database.Connect(); err != nil {
		t.Fatalf("connect: %v", err)
	}
	var n int64
	database.DB.Model(&models.Arsip{}).Count(&n)
	t.Logf("arsip count = %d", n)
	var sample []models.Arsip
	database.DB.Limit(3).Find(&sample)
	for _, a := range sample {
		t.Logf("  arsip: nomor=%s nama=%s status=%s", a.NomorArsip, a.NamaArsip, a.StatusArsip)
	}
	// master options counts
	for _, tbl := range []string{"unit_kerja", "jenis_arsip", "kode_klasifikasi", "pemberkasan", "users"} {
		var c int64
		database.DB.Table(tbl).Count(&c)
		t.Logf("table %s count = %d", tbl, c)
	}
}
