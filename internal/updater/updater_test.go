package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestVersionGreater(t *testing.T) {
	cases := []struct {
		latest, current string
		want            bool
	}{
		{"1.0.1", "1.0.0", true},
		{"v1.2.0", "1.1.9", true},
		{"1.0.0", "1.0.0", false},
		{"1.0.0", "1.0.0-3-gabc", false},
		{"1.1.0", "1.0.9", true},
		{"2", "1.9.9", true},
		{"1.0.0", "dev", true},
		{"", "1.0.0", false},
	}
	for _, c := range cases {
		if got := VersionGreater(c.latest, c.current); got != c.want {
			t.Errorf("VersionGreater(%q, %q) = %v, want %v", c.latest, c.current, got, c.want)
		}
	}
}

func TestPickAsset(t *testing.T) {
	assets := []Asset{
		{Name: "simarc_1.0.0-1_amd64.deb", URL: "https://x/deb"},
		{Name: "SIMARC-Setup.exe", URL: "https://x/setup"},
		{Name: "SIMARC-arm64.zip", URL: "https://x/arm"},
	}
	if a, ok := PickAsset(assets, "linux", "amd64"); !ok || a.URL != "https://x/deb" {
		t.Fatalf("linux/amd64 memilih %+v, ok=%v", a, ok)
	}
	if a, ok := PickAsset(assets, "windows", "amd64"); !ok || a.URL != "https://x/setup" {
		t.Fatalf("windows/amd64 memilih %+v, ok=%v", a, ok)
	}
	if _, ok := PickAsset(assets, "linux", "arm64"); ok {
		t.Fatal("linux/arm64 seharusnya tidak punya aset yang cocok")
	}
	if a, ok := PickAsset(assets, "darwin", "arm64"); !ok || a.URL != "https://x/arm" {
		t.Fatalf("darwin/arm64 memilih %+v, ok=%v", a, ok)
	}
}

func TestPickAssetPrefersReleaseVersion(t *testing.T) {
	assets := []Asset{
		{Name: "simarc_1.0.0-1_amd64.deb", URL: "https://x/old"},
		{Name: "simarc_1.1.0-1_amd64.deb", URL: "https://x/new"},
		{Name: "SIMARC-Setup.exe", URL: "https://x/setup"},
	}
	if a, ok := pickAssetForVersion(assets, "linux", "amd64", "1.1.0"); !ok || a.URL != "https://x/new" {
		t.Fatalf("linux/amd64 memilih %+v, ok=%v", a, ok)
	}
	// Windows tidak memuat versi pada nama aset → tetap memakai installer.
	if a, ok := pickAssetForVersion(assets, "windows", "amd64", "1.1.0"); !ok || a.URL != "https://x/setup" {
		t.Fatalf("windows/amd64 memilih %+v, ok=%v", a, ok)
	}
}

func TestCheckUsesAssets(t *testing.T) {
	sum := sha256.Sum256([]byte("deb-bytes"))
	digest := "sha256:" + hex.EncodeToString(sum[:])
	body := `{
		"tag_name":"v9.9.9",
		"body":"catatan rilis",
		"html_url":"https://example.test/release",
		"published_at":"2026-11-12T00:00:00Z",
		"draft":false,
		"prerelease":false,
		"assets":[
			{"name":"simarc_9.9.8-1_amd64.deb","browser_download_url":"https://example.test/old.deb","size":1,"digest":"sha256:0000000000000000000000000000000000000000000000000000000000000000"},
			{"name":"simarc_9.9.9_amd64.deb","browser_download_url":"https://example.test/a.deb","size":9,"digest":"` + digest + `"}
		]
	}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()

	info, err := Check(context.Background(), "1.0.0", srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	if !info.HasUpdate || info.Latest != "9.9.9" {
		t.Fatalf("info tidak sesuai: %+v", info)
	}
	if info.DownloadURL != "https://example.test/a.deb" {
		t.Fatalf("download URL = %q", info.DownloadURL)
	}
	if info.SHA256 != hex.EncodeToString(sum[:]) {
		t.Fatalf("sha256 = %q", info.SHA256)
	}
}

func TestDownloadVerifiesChecksum(t *testing.T) {
	payload := []byte("simarc-update-payload")
	sum := sha256.Sum256(payload)
	want := hex.EncodeToString(sum[:])

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(payload)
	}))
	defer srv.Close()

	dl, err := Download(context.Background(), srv.URL+"/simarc.deb", want)
	if err != nil {
		t.Fatal(err)
	}
	if dl.Size != int64(len(payload)) || dl.SHA256 != want {
		t.Fatalf("hasil unduhan salah: %+v", dl)
	}

	if _, err := Download(context.Background(), srv.URL+"/simarc.deb", strings.Repeat("0", 64)); err == nil {
		t.Fatal("checksum salah seharusnya ditolak")
	}
}
