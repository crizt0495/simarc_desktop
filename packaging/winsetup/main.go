//go:build windows
// +build windows

// SIMARC-Setup.exe — self-installer untuk Windows, dibangun ulang dari Linux
// (pengganti packaging/make-windows-package.sh yang tidak ikut ter-commit).
//
// Fungsi:
//  1. Ekstrak payload (SIMARC.exe, .env.example, README) ke %LocalAppData%\SIMARC
//  2. `.env` pengguna TIDAK pernah ditimpa (tidak ada di payload)
//  3. Buat shortcut Start Menu + Desktop (via PowerShell WScript.Shell COM)
//  4. Daftarkan entri Uninstall di registry HKCU + script Uninstall-SIMARC.ps1
//  5. Jalankan aplikasi di akhir (opsional: -norun untuk silent install)
//
// Build (dari Linux):
//   cp build/bin/SIMARC.exe packaging/winsetup/payload/SIMARC.exe
//   cp .env packaging/winsetup/payload/.env
//   GOOS=windows CGO_ENABLED=0 go build -ldflags "-s -w -H windowsgui" -o dist/SIMARC-Setup.exe ./packaging/winsetup
//
// Atau cukup jalankan: bash scripts/build-windows-setup.sh
package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

//go:embed all:payload
var payload embed.FS

const (
	appName    = "SIMARC"
	installLog = "simarc-install.txt"
)

func mustWindows() {
	if runtime.GOOS != "windows" {
		fmt.Fprintln(os.Stderr, "Installer ini hanya untuk Windows.")
		os.Exit(1)
	}
}

// localAppData mengembalikan %LocalAppData% dengan fallback aman.
func localAppData() string {
	if u := os.Getenv("LOCALAPPDATA"); u != "" {
		return u
	}
	if home, err := os.UserHomeDir(); err == nil {
		return filepath.Join(home, "AppData", "Local")
	}
	return "."
}

func installDir() string {
	return filepath.Join(localAppData(), appName)
}

// managedEnvKey menandai kunci .env yang harus selalu mengikuti nilai bawaan
// installer agar semua komputer menunjuk database & penyimpanan yang sama.
func managedEnvKey(k string) bool {
	switch {
	case k == "DATABASE_URL", k == "SIMARC_WINDOW":
		return true
	case strings.HasPrefix(k, "DB_"),
		strings.HasPrefix(k, "DIGITAL_"),
		strings.HasPrefix(k, "OFFSITE_S3_"):
		return true
	}
	return false
}

// mergeManagedEnv menggabungkan .env pengguna dengan nilai bawaan: kunci inti
// ditimpa nilai bawaan, urutan/komentar lain dipertahankan, dan kunci inti
// yang belum ada ditambahkan di akhir. Berkas tidak ada = pakai bawaan penuh.
func mergeManagedEnv(path string, defaults []byte) ([]byte, error) {
	type kv struct{ K, V string }
	var defs []kv
	defMap := map[string]string{}
	for _, line := range strings.Split(string(defaults), "\n") {
		line = strings.TrimRight(line, "\r")
		eq := strings.Index(line, "=")
		if eq <= 0 || strings.HasPrefix(strings.TrimSpace(line), "#") {
			continue
		}
		k := strings.TrimSpace(line[:eq])
		v := strings.TrimSpace(line[eq+1:])
		if !managedEnvKey(k) {
			continue
		}
		if _, ok := defMap[k]; !ok {
			defs = append(defs, kv{k, v})
		}
		defMap[k] = v
	}

	existing, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return defaults, nil
		}
		return nil, err
	}

	seen := map[string]bool{}
	var out []string
	for _, raw := range strings.Split(string(existing), "\n") {
		line := strings.TrimRight(raw, "\r")
		eq := strings.Index(line, "=")
		if eq > 0 && !strings.HasPrefix(strings.TrimSpace(line), "#") {
			k := strings.TrimSpace(line[:eq])
			if v, ok := defMap[k]; ok {
				out = append(out, k+"="+v)
				seen[k] = true
				continue
			}
		}
		out = append(out, line)
	}

	var missing []string
	for _, d := range defs {
		if !seen[d.K] {
			missing = append(missing, d.K+"="+d.V)
		}
	}
	if len(missing) > 0 {
		out = append(out, "", "# ── Diselaraskan otomatis oleh installer SIMARC ──")
		out = append(out, missing...)
	}
	return []byte(strings.Join(out, "\n") + "\n"), nil
}

// writePayload menyalin seluruh isi embed payload ke dir.
func writePayload(dir string, logf func(string)) error {
	return fs.WalkDir(payload, "payload", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel := strings.TrimPrefix(path, "payload/")
		// .env pengguna tidak pernah ditimpa saat update; file ini ditangani
		// terpisah (hanya dibuat bila belum ada).
		if rel == ".env" {
			return nil
		}
		data, err := payload.ReadFile(path)
		if err != nil {
			return err
		}
		dest := filepath.Join(dir, rel)
		if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(dest, data, 0o644); err != nil {
			return err
		}
		logf("ditulis: " + dest)
		return nil
	})
}

// createShortcut membuat .lnk via PowerShell COM; kembali false bila gagal (tidak fatal).
func createShortcut(lnkPath, targetPath, workDir, desc string, logf func(string)) bool {
	if err := os.MkdirAll(filepath.Dir(lnkPath), 0o755); err != nil {
		logf("folder shortcut gagal: " + err.Error())
		return false
	}
	ps := fmt.Sprintf(
		"$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%s');$s.TargetPath='%s';$s.WorkingDirectory='%s';$s.Description='%s';$s.Save()",
		strings.ReplaceAll(lnkPath, `'`, `''`),
		strings.ReplaceAll(targetPath, `'`, `''`),
		strings.ReplaceAll(workDir, `'`, `''`),
		desc)
	cmd := exec.Command("powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := cmd.Run(); err != nil {
		logf(fmt.Sprintf("shortcut gagal (%s): %v", lnkPath, err))
		return false
	}
	logf("shortcut: " + lnkPath)
	return true
}

var user32 = windows.NewLazySystemDLL("user32.dll")

// messageBox tampilkan dialog Win32 (pura-pura console saja jika gagal).
func messageBox(title, text string, isErr bool) {
	proc := user32.NewProc("MessageBoxW")
	titleW, _ := syscall.UTF16PtrFromString(title)
	textW, _ := syscall.UTF16PtrFromString(text)
	flag := uintptr(0x40) // MB_ICONINFORMATION
	if isErr {
		flag = 0x10 // MB_ICONERROR
	}
	proc.Call(0, uintptr(unsafe.Pointer(textW)), uintptr(unsafe.Pointer(titleW)), flag)
}

func logInit(dir string) (lg *log.Logger, path string) {
	f, err := os.OpenFile(filepath.Join(dir, installLog), os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		lgOut := log.New(os.Stderr, "", log.LstdFlags)
		return lgOut, ""
	}
	return log.New(f, "", log.LstdFlags), filepath.Join(dir, installLog)
}

func main() {
	mustWindows()

	norun := false
	for _, a := range os.Args[1:] {
		if a == "-norun" {
			norun = true
		}
	}

	dir := installDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "tidak dapat membuat %s: %v\n", dir, err)
		os.Exit(1)
	}
	lg, logPath := logInit(dir)
	logf := func(s string) { lg.Println(s) }

	// 1) Payload
	if err := writePayload(dir, logf); err != nil {
		msg := "Ekstrak payload gagal:\n" + err.Error()
		if logPath != "" {
			msg += "\n\nLog: " + logPath
		}
		messageBox("SIMARC — Instalasi Gagal", msg, true)
		os.Exit(1)
	}
	exe := filepath.Join(dir, "SIMARC.exe")

	// 1b) .env — konfigurasi inti (database TiDB, penyimpanan S3, mode jendela)
	// SELALU diselaraskan dengan nilai bawaan installer. Ini mencegah masalah
	// "data tidak muncul" akibat .env lama dari versi sebelumnya (mis. masih
	// menunjuk SQLite/MySQL lokal atau tanpa kredensial S3). Kunci lain milik
	// pengguna (nama instansi, dsb.) tetap dipertahankan.
	envDest := filepath.Join(dir, ".env")
	if defaults, readErr := payload.ReadFile("payload/.env"); readErr == nil {
		merged, mergeErr := mergeManagedEnv(envDest, defaults)
		if mergeErr != nil {
			logf("gagal menyiapkan .env: " + mergeErr.Error())
		} else if writeErr := os.WriteFile(envDest, merged, 0o600); writeErr != nil {
			logf("gagal menulis .env: " + writeErr.Error())
		} else {
			logf("diselaraskan: " + envDest)
		}
	} else {
		logf("nilai bawaan .env tidak ditemukan di installer: " + readErr.Error())
	}

	// 2) Shortcut (Start Menu + Desktop)
	startMenu := filepath.Join(localAppData(), "Microsoft", "Windows", "Start Menu", "Programs")
	if ad := os.Getenv("APPDATA"); ad != "" {
		startMenu = filepath.Join(ad, "Microsoft", "Windows", "Start Menu", "Programs")
	}
	desktop := filepath.Join(localAppData(), "Microsoft", "Windows", "Desktop")
	if home, err := os.UserHomeDir(); err == nil {
		cand := filepath.Join(home, "Desktop")
		if _, statErr := os.Stat(cand); statErr == nil {
			// Desktop klasik di UserProfile (Memungkinkan OneDrive memindahkannya, fallback lokal tidak apa-apa)
			if _, odErr := os.Stat(filepath.Join(home, "OneDrive")); odErr == nil {
				if od := filepath.Join(home, "OneDrive", "Desktop"); statDir(od) {
					cand = od
				}
			}
			desktop = cand
		}
	}
	createShortcut(filepath.Join(startMenu, "SIMARC.lnk"), exe, dir, "SIMARC — Arsip Record Center", logf)
	createShortcut(filepath.Join(desktop, "SIMARC.lnk"), exe, dir, "SIMARC — Arsip Record Center", logf)

	// 3) Entri uninstall di registry HKCU + script uninstaller
	uninstallPS := fmt.Sprintf(
		`Remove-Item -Recurse -Force -ErrorAction SilentlyContinue '%s'
Remove-Item -Force -ErrorAction SilentlyContinue '%s\%s.lnk'`,
		dir, startMenu, appName)
	os.WriteFile(filepath.Join(dir, "Uninstall-SIMARC.ps1"), []byte(uninstallPS), 0o644)

	key, _, err := registry.CreateKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Uninstall\SIMARC`, registry.ALL_ACCESS)
	if err != nil {
		logf("registry uninstall tidak dapat dibuat: " + err.Error())
	} else {
		defer key.Close()
		key.SetStringValue("DisplayName", "SIMARC — Arsip Record Center")
		key.SetStringValue("DisplayIcon", exe+",0")
		key.SetStringValue("InstallLocation", dir)
		key.SetExpandStringValue("UninstallString",
			fmt.Sprintf(`powershell -NoProfile -ExecutionPolicy Bypass -File "%s\Uninstall-SIMARC.ps1"`, dir))
		key.SetStringValue("NoModify", "1")
		key.SetStringValue("NoRepair", "1")
		key.SetStringValue("Publisher", "SIMARC")
	}
	logf("entry uninstall registry + Uninstall-SIMARC.ps1 selesai")

	// 4) Jalankan aplikasi (default: ya; -norun untuk silent install)
	if !norun {
		go func() {
			cmd := exec.Command(exe)
			cmd.Dir = dir
			if err := cmd.Start(); err != nil {
				logf("gagal menjalankan aplikasi: " + err.Error())
			}
		}()
		messageBox("SIMARC — Terpasang",
			"Aplikasi terpasang di:\n"+dir+"\n\nShortcut Start Menu & Desktop sudah dibuat.\nAplikasi akan dibuka.", false)
	} else {
		fmt.Println("Installed (silent): " + dir)
	}
}

func statDir(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}
