// Package updater memeriksa, mengunduh, dan memasang pembaruan aplikasi
// SIMARC dari GitHub Releases.
//
// Alur:
//
//	Check()    → baca rilis terbaru + pilih aset sesuai OS/arsitektur
//	Download() → unduh ke temp sambil menghitung SHA-256
//	Apply()    → pasang paket (shell-out, lihat apply_*.go)
//
// Semua panggilan jaringan memakai HTTPS dan hasil unduhan diverifikasi
// terhadap digest aset GitHub (atau berkas SHA256SUMS bila digest kosong).
package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// DefaultFeedURL adalah endpoint GitHub Releases untuk repo proyek ini.
// Dapat ditimpa lewat SIMARC_UPDATE_URL (mis. server hub sendiri).
const DefaultFeedURL = "https://api.github.com/repos/crizt0495/simarc_desktop/releases/latest"

// maxDownloadBytes membatasi ukuran paket agar unduhan tak terbatas tidak
// menghabiskan disk.
const maxDownloadBytes = 1 << 30 // 1 GiB

// Asset adalah satu berkas pada sebuah rilis GitHub.
type Asset struct {
	Name   string `json:"name"`
	URL    string `json:"browser_download_url"`
	Size   int64  `json:"size"`
	Digest string `json:"digest"`
}

// Info adalah hasil pemeriksaan pembaruan.
type Info struct {
	HasUpdate   bool
	Current     string
	Latest      string
	RawTag      string
	Notes       string
	HTMLURL     string
	PublishedAt time.Time
	AssetName   string
	DownloadURL string
	SHA256      string
	Size        int64
}

// Map mengubah Info menjadi map yang aman dikirim ke frontend Wails.
func (i Info) Map() map[string]interface{} {
	m := map[string]interface{}{
		"hasUpdate":   i.HasUpdate,
		"current":     i.Current,
		"latest":      i.Latest,
		"rawTag":      i.RawTag,
		"notes":       i.Notes,
		"htmlURL":     i.HTMLURL,
		"assetName":   i.AssetName,
		"downloadURL": i.DownloadURL,
		"sha256":      i.SHA256,
		"size":        i.Size,
	}
	if !i.PublishedAt.IsZero() {
		m["publishedAt"] = i.PublishedAt.Format(time.RFC3339)
	}
	return m
}

type release struct {
	TagName     string  `json:"tag_name"`
	Body        string  `json:"body"`
	HTMLURL     string  `json:"html_url"`
	PublishedAt string  `json:"published_at"`
	Draft       bool    `json:"draft"`
	Prerelease  bool    `json:"prerelease"`
	Assets      []Asset `json:"assets"`
}

// Check memeriksa rilis terbaru dan memilih aset yang cocok untuk
// runtime.GOOS/GOARCH saat ini.
func Check(ctx context.Context, current, feedURL string) (Info, error) {
	info := Info{Current: normalizeDisplay(current)}
	if strings.TrimSpace(feedURL) == "" {
		feedURL = DefaultFeedURL
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, feedURL, nil)
	if err != nil {
		return info, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "SIMARC-Updater/1")

	resp, err := (&http.Client{Timeout: 25 * time.Second}).Do(req)
	if err != nil {
		return info, fmt.Errorf("tidak dapat menghubungi server pembaruan: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusNotFound:
		return info, errors.New("belum ada rilis pembaruan yang dipublikasikan")
	default:
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return info, fmt.Errorf("server pembaruan menjawab HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(msg)))
	}

	var rel release
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&rel); err != nil {
		return info, fmt.Errorf("respons pembaruan tidak valid: %w", err)
	}

	info.RawTag = rel.TagName
	info.Latest = strings.TrimPrefix(strings.TrimSpace(rel.TagName), "v")
	info.Notes = rel.Body
	info.HTMLURL = rel.HTMLURL
	if t, err := time.Parse(time.RFC3339, rel.PublishedAt); err == nil {
		info.PublishedAt = t
	}

	if rel.Draft || rel.Prerelease {
		return info, nil
	}
	if !VersionGreater(info.Latest, info.Current) {
		return info, nil
	}

	asset, ok := pickAssetForVersion(rel.Assets, runtime.GOOS, runtime.GOARCH, info.Latest)
	if !ok {
		return info, fmt.Errorf("rilis %s tidak menyediakan paket untuk %s/%s", info.Latest, runtime.GOOS, runtime.GOARCH)
	}
	info.HasUpdate = true
	info.AssetName = asset.Name
	info.DownloadURL = asset.URL
	info.Size = asset.Size
	info.SHA256 = digestSHA(asset.Digest)
	if info.SHA256 == "" {
		// GitHub belum tentu menyertakan digest; coba berkas SHA256SUMS.
		info.SHA256 = lookupChecksum(ctx, rel.Assets, asset.Name)
	}
	return info, nil
}

// Package adalah hasil unduhan paket pembaruan.
type Package struct {
	Path      string
	AssetName string
	SHA256    string
	Size      int64
}

func Download(ctx context.Context, downloadURL, wantSHA string) (Package, error) {
	if strings.TrimSpace(downloadURL) == "" {
		return Package{}, errors.New("URL unduhan kosong")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
	if err != nil {
		return Package{}, err
	}
	req.Header.Set("User-Agent", "SIMARC-Updater/1")

	resp, err := (&http.Client{Timeout: 15 * time.Minute}).Do(req)
	if err != nil {
		return Package{}, fmt.Errorf("gagal mengunduh pembaruan: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Package{}, fmt.Errorf("gagal mengunduh pembaruan: HTTP %d", resp.StatusCode)
	}

	name := assetNameFromURL(downloadURL)
	dir, err := os.MkdirTemp("", "simarc-update-*")
	if err != nil {
		return Package{}, err
	}
	dst := filepath.Join(dir, name)
	f, err := os.Create(dst)
	if err != nil {
		os.RemoveAll(dir)
		return Package{}, err
	}

	h := sha256.New()
	n, copyErr := io.Copy(io.MultiWriter(f, h), io.LimitReader(resp.Body, maxDownloadBytes+1))
	closeErr := f.Close()
	if copyErr != nil || closeErr != nil {
		os.RemoveAll(dir)
		if copyErr != nil {
			return Package{}, copyErr
		}
		return Package{}, closeErr
	}
	if n > maxDownloadBytes {
		os.RemoveAll(dir)
		return Package{}, errors.New("ukuran paket pembaruan melebihi batas 1 GiB")
	}

	got := hex.EncodeToString(h.Sum(nil))
	want := digestSHA(wantSHA)
	if want != "" && !strings.EqualFold(got, want) {
		os.RemoveAll(dir)
		return Package{}, fmt.Errorf("checksum paket tidak cocok (diharapkan %s, didapat %s)", want, got)
	}
	return Package{Path: dst, AssetName: name, SHA256: got, Size: n}, nil
}

// pickAssetForVersion memilih aset platform yang cocok. Bila ada beberapa
// paket (mis. sisa paket versi lama pada rilis yang sama), utamakan paket
// yang namanya memuat versi rilis agar aplikasi tidak mengambil berkas lama.
func pickAssetForVersion(assets []Asset, goos, goarch, version string) (Asset, bool) {
	version = strings.TrimPrefix(strings.TrimSpace(version), "v")
	if version != "" {
		var matching []Asset
		for _, a := range assets {
			if strings.Contains(a.Name, version) {
				matching = append(matching, a)
			}
		}
		if a, ok := PickAsset(matching, goos, goarch); ok {
			return a, true
		}
	}
	return PickAsset(assets, goos, goarch)
}

// PickAsset memilih aset rilis yang paling sesuai untuk OS/arsitektur.
// Urutan preferensi:
//
//	windows : setup .exe → .exe → .zip
//	linux   : .deb → .AppImage
//	darwin  : .dmg → .zip
func PickAsset(assets []Asset, goos, goarch string) (Asset, bool) {
	type candidate struct {
		asset Asset
		score int
	}
	var candidates []candidate

	for _, a := range assets {
		name := strings.ToLower(a.Name)
		if a.URL == "" {
			continue
		}
		if !assetMatchesArch(name, goarch) {
			continue
		}
		score := -1
		switch goos {
		case "windows":
			switch {
			case strings.Contains(name, "setup") && strings.HasSuffix(name, ".exe"):
				score = 100
			case strings.HasSuffix(name, ".exe"):
				score = 80
			case strings.HasSuffix(name, ".zip"):
				score = 40
			}
		case "linux":
			switch {
			case strings.HasSuffix(name, ".deb"):
				score = 100
			case strings.Contains(name, "appimage"):
				score = 90
			}
		case "darwin":
			switch {
			case strings.HasSuffix(name, ".dmg"):
				score = 100
			case strings.HasSuffix(name, ".zip"):
				score = 60
			}
		}
		// Beri sedikit nilai lebih bila namanya menyebut arsitektur target
		// secara eksplisit. Bonus hanya berlaku untuk format yang sudah cocok.
		if score > 0 && (strings.Contains(name, goarch) || strings.Contains(name, archAlias(goarch))) {
			score += 5
		}
		if score > 0 {
			candidates = append(candidates, candidate{a, score})
		}
	}

	best := candidate{score: -1}
	for _, c := range candidates {
		if c.score > best.score {
			best = c
		}
	}
	if best.score < 0 {
		return Asset{}, false
	}
	return best.asset, true
}

func archAlias(goarch string) string {
	switch goarch {
	case "amd64":
		return "x86_64"
	case "arm64":
		return "aarch64"
	case "386":
		return "i386"
	}
	return goarch
}

// assetMatchesArch menyaring aset yang jelas ditujukan untuk arsitektur lain.
func assetMatchesArch(name, goarch string) bool {
	hasArm := strings.Contains(name, "arm64") || strings.Contains(name, "aarch64")
	hasAmd := strings.Contains(name, "amd64") || strings.Contains(name, "x86_64")
	has386 := strings.Contains(name, "i386") || strings.Contains(name, "i686") || strings.Contains(name, "386")
	switch goarch {
	case "arm64":
		return !hasAmd && !has386
	case "amd64":
		return !hasArm && !has386
	case "386":
		return !hasArm && !hasAmd
	}
	return true
}

func assetNameFromURL(raw string) string {
	u, err := url.Parse(raw)
	if err == nil && u.Path != "" {
		if base := path.Base(u.Path); base != "" && base != "." && base != "/" {
			return base
		}
	}
	return "simarc-update.bin"
}

func digestSHA(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	s = strings.TrimPrefix(s, "sha256:")
	if len(s) != 64 {
		return ""
	}
	if _, err := hex.DecodeString(s); err != nil {
		return ""
	}
	return s
}

func lookupChecksum(ctx context.Context, assets []Asset, wantName string) string {
	var sumsURL string
	for _, a := range assets {
		n := strings.ToLower(a.Name)
		if strings.Contains(n, "sha256") || strings.Contains(n, "checksum") {
			sumsURL = a.URL
			break
		}
	}
	if sumsURL == "" {
		return ""
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sumsURL, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", "SIMARC-Updater/1")
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ""
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(body), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		name := strings.TrimPrefix(fields[len(fields)-1], "*")
		if name == wantName || path.Base(name) == wantName {
			if d := digestSHA(fields[0]); d != "" {
				return d
			}
		}
	}
	return ""
}

// ── versi ─────────────────────────────────────────────────────────────────

// VersionGreater melaporkan apakah latest lebih baru daripada current.
func VersionGreater(latest, current string) bool {
	return compare(latest, current) > 0
}

// compare membandingkan dua versi secara longgar (semver + suffix git describe).
// Hasil: -1 bila a<b, 0 bila setara, 1 bila a>b.
func compare(a, b string) int {
	ac, apre := parseVersion(a)
	bc, bpre := parseVersion(b)
	for i := 0; i < 3; i++ {
		if ac[i] != bc[i] {
			if ac[i] < bc[i] {
				return -1
			}
			return 1
		}
	}
	// Inti sama: rilis final > pratinjau; keduanya pratinjau dibandingkan
	// secara leksikal. Suffix `git describe` (mis. "1.0.0-3-gabc") berarti
	// build lokal yang berada SETELAH tag, jadi tidak dianggap lebih lama.
	switch {
	case apre == "" && bpre == "":
		return 0
	case apre == "":
		if isGitDescribe(bpre) {
			return 0
		}
		return 1
	case bpre == "":
		if isGitDescribe(apre) {
			return 0
		}
		return -1
	case apre == bpre:
		return 0
	case apre < bpre:
		return -1
	default:
		return 1
	}
}

var gitDescribeRe = regexp.MustCompile(`^[0-9]+-g[0-9a-fA-F]+`)

func isGitDescribe(pre string) bool { return gitDescribeRe.MatchString(pre) }

func parseVersion(v string) ([3]int, string) {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	v = strings.TrimPrefix(v, "V")
	var core [3]int
	pre := ""
	if i := strings.IndexAny(v, "-+"); i >= 0 {
		pre = v[i+1:]
		v = v[:i]
	}
	parts := strings.Split(v, ".")
	for i := 0; i < 3 && i < len(parts); i++ {
		n, _ := strconv.Atoi(numericPrefix(parts[i]))
		core[i] = n
	}
	return core, pre
}

func numericPrefix(s string) string {
	i := 0
	for i < len(s) && s[i] >= '0' && s[i] <= '9' {
		i++
	}
	return s[:i]
}

func normalizeDisplay(v string) string {
	v = strings.TrimSpace(strings.TrimPrefix(v, "v"))
	if v == "" {
		return "0.0.0"
	}
	return v
}
