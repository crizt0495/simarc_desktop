package main

import "testing"

func TestKlasifikasiBox(t *testing.T) {
	cases := []struct {
		name            string
		total, spj, non int64
		want            string
	}{
		{"box kosong", 0, 0, 0, ""},
		{"murni SPJ", 10, 10, 0, "spj"},
		{"murni Non SPJ", 8, 0, 8, "non"},
		{"campuran", 12, 5, 7, "campuran"},
		{"ada yang belum terklasifikasi", 10, 4, 0, ""},
		{"SPJ plus belum terklasifikasi", 10, 9, 0, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := klasifikasiBox(c.total, c.spj, c.non)
			if got != c.want {
				t.Fatalf("klasifikasiBox(%d, %d, %d) = %q, ingin %q", c.total, c.spj, c.non, got, c.want)
			}
		})
	}
}
