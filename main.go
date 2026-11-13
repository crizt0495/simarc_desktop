package main

import (
	"bufio"
	"embed"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed .env
var embeddedDotEnv string

// appVersion diisi saat build:
//
//	go build -ldflags "-X main.appVersion=v1.2.3"
//
// Nilai ini dipakai auto-update untuk membandingkan versi lokal dengan rilis
// terbaru di GitHub.
var appVersion = "1.0.0"

// setupLogFile mengalihkan log ke berkas agar masalah di komputer pengguna
// (mis. database tidak tersambung) bisa diperiksa tanpa membuka konsol.
// Lokasi: %AppData%\SIMARC\simarc.log (Windows) / ~/.config/SIMARC/simarc.log.
func setupLogFile() {
	base, err := os.UserConfigDir()
	if err != nil || base == "" {
		return
	}
	dir := filepath.Join(base, "SIMARC")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return
	}
	f, err := os.OpenFile(filepath.Join(dir, "simarc.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	log.SetOutput(io.MultiWriter(os.Stderr, f))
	log.SetFlags(log.LstdFlags)
	exe, _ := os.Executable()
	wd, _ := os.Getwd()
	log.Printf("=== SIMARC mulai %s ===", time.Now().Format(time.RFC3339))
	log.Printf("exe=%s", exe)
	log.Printf("cwd=%s", wd)
}

func main() {
	setupLogFile()
	app := NewApp()

	// Mode jendela: "maximized" (default, judul + tombol OS tetap ada),
	// "normal", "fullscreen", atau "kiosk".
	window := strings.ToLower(readDotEnv("SIMARC_WINDOW", "maximized"))

	opts := &options.App{
		Title:     "SIMARC — Arsip Record Center",
		Width:     1200,
		Height:    760,
		MinWidth:  900,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 243, G: 245, B: 249, A: 255},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
		Linux: &linux.Options{
			WindowIsTranslucent: false,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			// Render perangkat lunak (tanpa GPU) menghindari layar kosong /
			// tidak responsif pada sebagian driver Intel, VM, dan Remote
			// Desktop. Dapat diaktifkan lagi dengan SIMARC_DISABLE_GPU=false.
			WebviewGpuIsDisabled: readBool("SIMARC_DISABLE_GPU", true),
		},
		Mac:              &mac.Options{},
		WindowStartState: windowOpts(window).startState,
		Frameless:        windowOpts(window).frameless,
		DisableResize:    windowOpts(window).disallowResize,
	}

	if err := wails.Run(opts); err != nil {
		println("Error:", err.Error())
	} else {
		println("wails.Run selesai (jendela ditutup)")
	}
}

type windowFlags struct {
	startState     options.WindowStartState
	frameless      bool
	disallowResize bool
}

func windowOpts(mode string) windowFlags {
	switch mode {
	case "maximized":
		return windowFlags{startState: options.Maximised}
	case "normal":
		return windowFlags{startState: options.Normal}
	case "kiosk":
		return windowFlags{startState: options.Fullscreen, frameless: true, disallowResize: true}
	case "fullscreen":
		return windowFlags{startState: options.Fullscreen}
	}
	return windowFlags{startState: options.Maximised}
}

// readBool membaca nilai boolean dari .env/env dengan fallback.
func readBool(key string, fallback bool) bool {
	v := strings.ToLower(strings.TrimSpace(readDotEnv(key, "")))
	if v == "" {
		return fallback
	}
	switch v {
	case "1", "true", "yes", "on", "ya":
		return true
	case "0", "false", "no", "off", "tidak":
		return false
	}
	return fallback
}

func readDotEnv(key, fb string) string {
	paths := []string{".env"}
	if exe, err := os.Executable(); err == nil {
		paths = append(paths, filepath.Join(filepath.Dir(exe), ".env"))
	}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		paths = append(paths, filepath.Join(home, ".env"))
	}
	for _, p := range paths {
		f, err := os.Open(p)
		if err != nil {
			continue
		}
		sc := bufio.NewScanner(f)
		for sc.Scan() {
			line := strings.TrimSpace(sc.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			if eq := strings.Index(line, "="); eq > 0 && strings.TrimSpace(line[:eq]) == key {
				f.Close()
				return strings.Trim(strings.TrimSpace(line[eq+1:]), `"'`)
			}
		}
		f.Close()
	}
	// Fallback: .env yang di-embed ke biner (agar .exe Windows standalone).
	for _, line := range strings.Split(embeddedDotEnv, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if eq := strings.Index(line, "="); eq > 0 && strings.TrimSpace(line[:eq]) == key {
			return strings.Trim(strings.TrimSpace(line[eq+1:]), `"'`)
		}
	}
	return fb
}
