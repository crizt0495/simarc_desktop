package main

import "testing"

func TestShouldCacheOpts(t *testing.T) {
	full := map[string][]map[string]interface{}{
		"unitKerja":       {{"id": "u1"}},
		"kodeKlasifikasi": {{"id": "k1"}},
	}
	cases := []struct {
		name   string
		out    map[string][]map[string]interface{}
		failed bool
		want   bool
	}{
		{"lengkap", full, false, true},
		{"query gagal", full, true, false},
		{"unit kerja kosong", map[string][]map[string]interface{}{"kodeKlasifikasi": full["kodeKlasifikasi"]}, false, false},
		{"klasifikasi kosong", map[string][]map[string]interface{}{"unitKerja": full["unitKerja"]}, false, false},
		{"semua kosong", map[string][]map[string]interface{}{}, false, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := shouldCacheOpts(c.out, c.failed); got != c.want {
				t.Fatalf("shouldCacheOpts() = %v, ingin %v", got, c.want)
			}
		})
	}
}
