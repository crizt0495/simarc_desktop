//go:build windows

package updater

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

// Apply memasang installer Windows.
//
// Installer (SIMARC-Setup.exe) tidak dapat menimpa SIMARC.exe yang sedang
// berjalan, jadi aplikasi membuat skrip batch sementara yang:
//
//  1. menunggu proses SIMARC lama berhenti (PID),
//  2. menjalankan installer dengan -norun,
//  3. membuka ulang aplikasi,
//  4. menghapus dirinya sendiri.
//
// Aplikasi lama langsung keluar (RestartedByUpdater=true).
func Apply(path, assetName string) (ApplyResult, error) {
	if !strings.HasSuffix(strings.ToLower(path), ".exe") && !strings.HasSuffix(strings.ToLower(assetName), ".exe") {
		return ApplyResult{}, fmt.Errorf("format paket %q belum didukung untuk Windows", assetName)
	}
	exe, err := os.Executable()
	if err != nil {
		return ApplyResult{}, err
	}
	bat := filepath.Join(filepath.Dir(path), "simarc-apply-update.bat")
	script := strings.Join([]string{
		"@echo off",
		"setlocal",
		":wait",
		`tasklist /FI "PID eq ` + strconv.Itoa(os.Getpid()) + `" 2>NUL | find /I "` + strconv.Itoa(os.Getpid()) + `" >NUL`,
		"if not errorlevel 1 (",
		"  timeout /t 1 /nobreak >NUL",
		"  goto wait",
		")",
		`"` + path + `" -norun`,
		`start "" "` + exe + `"`,
		`del "` + path + `" >NUL 2>&1`,
		`del "%~f0" >NUL 2>&1`,
		"",
	}, "\r\n")
	if err := os.WriteFile(bat, []byte(script), 0o600); err != nil {
		return ApplyResult{}, err
	}

	cmd := exec.Command("cmd", "/C", "start", "", "/B", bat)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x00000008} // DETACHED_PROCESS
	if err := cmd.Start(); err != nil {
		return ApplyResult{}, fmt.Errorf("gagal menjalankan pembaru: %w", err)
	}
	return ApplyResult{RestartedByUpdater: true}, nil
}
