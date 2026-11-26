package main

import (
	"testing"

	"arsippro/internal/database"

	sqlitedrv "github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// TestNomorArsipSudahDigunakan memastikan nomor arsip yang sama tidak bisa
// dipakai dua kali. Database SQLite dipakai HANYA sebagai fixture test;
// aplikasi tetap wajib memakai TiDB Cloud.
func TestNomorArsipSudahDigunakan(t *testing.T) {
	db, err := gorm.Open(sqlitedrv.Open("file:nomor_arsip_test?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("buka database test: %v", err)
	}
	if err := db.Exec(`CREATE TABLE arsip (
		id TEXT PRIMARY KEY,
		nomor_arsip TEXT,
		nama_arsip TEXT,
		kode_klasifikasi_id TEXT,
		unit_kerja_id TEXT,
		deleted_at DATETIME
	)`).Error; err != nil {
		t.Fatalf("siapkan tabel test: %v", err)
	}
	for _, q := range []string{
		`INSERT INTO arsip (id, nomor_arsip) VALUES ('a1', 'SK/001')`,
		`INSERT INTO arsip (id, nomor_arsip) VALUES ('a2', 'SK/002')`,
		`INSERT INTO arsip (id, nomor_arsip, deleted_at) VALUES ('a3', 'SK/003', '2026-01-01 00:00:00')`,
	} {
		if err := db.Exec(q).Error; err != nil {
			t.Fatalf("isi data test: %v", err)
		}
	}

	prev := database.DB
	database.DB = db
	defer func() { database.DB = prev }()

	cases := []struct {
		name      string
		nomor     string
		excludeID string
		want      bool
	}{
		{"nomor sama persis", "SK/001", "", true},
		{"spasi di tepi", "  sk/001  ", "", true},
		{"huruf besar/kecil", "sk/001", "", true},
		{"nomor lain", "SK/099", "", false},
		{"nomor kosong", "   ", "", false},
		{"edit arsip yang sama", "SK/001", "a1", false},
		{"edit ke nomor arsip lain", "SK/002", "a1", true},
		{"arsip terhapus tidak dihitung", "SK/003", "", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := nomorArsipSudahDigunakan(c.nomor, c.excludeID)
			if err != nil {
				t.Fatalf("nomorArsipSudahDigunakan: %v", err)
			}
			if got != c.want {
				t.Fatalf("nomorArsipSudahDigunakan(%q, %q) = %v, ingin %v", c.nomor, c.excludeID, got, c.want)
			}
		})
	}
}
