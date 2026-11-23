//go:build windows

package updater

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

// Apply memasang installer Windows.
//
// Installer (SIMARC-Setup.exe) tidak dapat menimpa SIMARC.exe yang sedang
// berjalan, jadi aplikasi membuat skrip PowerShell sementara yang:
//
//  1. menunggu proses SIMARC lama benar-benar berhenti (PID),
//  2. menjalankan installer dengan -norun,
//  3. membuka ulang aplikasi,
//  4. menghapus installer & skripnya,
//  5. mencatat setiap langkah ke %AppData%\SIMARC\simarc-updater.log.
//
// Aplikasi lama keluar setelah frontend sempat menerima jawaban ApplyUpdate.
func Apply(path, assetName string) (ApplyResult, error) {
	if !strings.HasSuffix(strings.ToLower(path), ".exe") && !strings.HasSuffix(strings.ToLower(assetName), ".exe") {
		return ApplyResult{}, fmt.Errorf("format paket %q belum didukung untuk Windows", assetName)
	}
	exe, err := os.Executable()
	if err != nil {
		return ApplyResult{}, err
	}
	logPath, err := updateLogPath()
	if err != nil {
		return ApplyResult{}, err
	}

	dir := filepath.Dir(path)
	scriptPath := filepath.Join(dir, "simarc-apply-update.ps1")
	script := powershellUpdaterScript(path, exe, filepath.Dir(exe), logPath, scriptPath, os.Getpid())
	if err := os.WriteFile(scriptPath, []byte(script), 0o600); err != nil {
		return ApplyResult{}, fmt.Errorf("gagal menulis skrip pembaru: %w", err)
	}

	// powershell.exe dijalankan terlepas dari aplikasi (DETACHED_PROCESS)
	// sehingga tetap hidup setelah SIMARC ditutup. -WindowStyle Hidden
	// mencegah jendela konsol berkedip di desktop pengguna.
	cmd := exec.Command("powershell.exe",
		"-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden",
		"-File", scriptPath)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x00000008, // DETACHED_PROCESS
	}
	if err := cmd.Start(); err != nil {
		_ = os.Remove(scriptPath)
		return ApplyResult{}, fmt.Errorf("gagal menjalankan pembaru: %w", err)
	}
	return ApplyResult{RestartedByUpdater: true}, nil
}
