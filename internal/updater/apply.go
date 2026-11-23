package updater

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// ApplyResult menjelaskan apa yang terjadi setelah paket dipasang.
type ApplyResult struct {
	// RestartedByUpdater menandakan proses update akan membuka ulang aplikasi
	// sendiri (Windows memakai helper yang menunggu proses lama berhenti).
	// Bila false, pemanggil yang harus memanggil Relaunch().
	RestartedByUpdater bool
}

// psQuote mengubah s menjadi literal string PowerShell yang aman. Memakai
// petik tunggal menghindari Interpretasi '$', backtick, dan karakter lain
// pada path pengguna (mis. "O'Brien").
func psQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "''") + "'"
}

// powershellUpdaterScript menyusun skrip pembaruan Windows. Skrip ini sengaja
// dibangun di berkas tanpa build tag agar bisa diuji pada platform mana pun.
//
// Skrip menunggu proses lama benar-benar keluar, menjalankan installer dengan
// -norun, mencatat exit code ke log, lalu membuka ulang aplikasi. Memakai
// Start-Sleep/WaitForExit alih-alih `timeout` penting karena proses Wails
// berjalan tanpa konsol; `timeout` akan langsung gagal pada kondisi tersebut.
func powershellUpdaterScript(installer, app, appDir, logPath, scriptPath string, pid int) string {
	lines := []string{
		"$ErrorActionPreference = 'Continue'",
		"$log = " + psQuote(logPath),
		"$installer = " + psQuote(installer),
		"$app = " + psQuote(app),
		"$appDir = " + psQuote(appDir),
		"$script = " + psQuote(scriptPath),
		"$oldPid = " + strconv.Itoa(pid),
		`function Write-UpdateLog { param([string]$Message) Add-Content -LiteralPath $log -Value ("{0} {1}" -f (Get-Date -Format s), $Message) }`,
		`Write-UpdateLog "Pembaru SIMARC dimulai; menunggu PID lama $oldPid."`,
		`try {`,
		`  $old = Get-Process -Id $oldPid -ErrorAction SilentlyContinue`,
		`  if ($old) {`,
		`    Write-UpdateLog "Proses lama masih berjalan; menunggu maksimal 3 menit."`,
		`    $old.WaitForExit(180000) | Out-Null`,
		`  } else { Write-UpdateLog "Proses lama sudah berhenti." }`,
		`} catch { Write-UpdateLog ("Gagal menunggu proses lama: " + $_.Exception.Message) }`,
		`try {`,
		`  Write-UpdateLog "Menjalankan installer silent (-norun)."`,
		`  $result = Start-Process -FilePath $installer -ArgumentList '-norun' -Wait -PassThru -WindowStyle Hidden`,
		`  Write-UpdateLog ("Installer selesai dengan exit code " + $result.ExitCode)`,
		`  if ($result.ExitCode -ne 0) { throw "Installer mengembalikan kode " + $result.ExitCode }`,
		`} catch {`,
		`  Write-UpdateLog ("GAGAL memasang pembaruan: " + $_.Exception.Message)`,
		`  exit 1`,
		`}`,
		`try {`,
		`  Write-UpdateLog "Membuka ulang aplikasi."`,
		`  Start-Process -FilePath $app -WorkingDirectory $appDir`,
		`} catch { Write-UpdateLog ("Gagal membuka ulang aplikasi: " + $_.Exception.Message) }`,
		`Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue`,
		`Remove-Item -LiteralPath $script -Force -ErrorAction SilentlyContinue`,
		`Write-UpdateLog "Alur pembaruan selesai."`,
		``,
	}
	return strings.Join(lines, "\r\n")
}

// updateLogPath memberi lokasi log pembaruan yang bisa dibaca pengguna.
func updateLogPath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil || base == "" {
		return "", fmt.Errorf("tidak dapat menemukan folder konfigurasi pengguna: %v", err)
	}
	dir := filepath.Join(base, "SIMARC")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(dir, "simarc-updater.log"), nil
}

// Relaunch menjalankan biner aplikasi yang sedang berjalan lalu keluar.
// Dipanggil setelah paket baru terpasang agar pengguna tidak perlu membuka
// aplikasi secara manual.
func Relaunch() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	cmd := exec.Command(exe)
	if wd, err := os.Getwd(); err == nil {
		cmd.Dir = wd
	}
	return cmd.Start()
}

// copyFile menyalin src ke dst dengan mode tertentu.
func copyFile(src, dst string, mode os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	if _, err := out.ReadFrom(in); err != nil {
		out.Close()
		os.Remove(dst)
		return err
	}
	return out.Close()
}

// replaceExecutable menukar biner yang sedang berjalan dengan berkas baru.
// Pada Linux, mengganti nama pada path executable yang sedang berjalan aman
// (inode lama tetap dipakai proses aktif sampai keluar).
func replaceExecutable(newPath string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	tmp := exe + ".new"
	if err := copyFile(newPath, tmp, 0o755); err != nil {
		return err
	}
	if err := os.Rename(tmp, exe); err != nil {
		os.Remove(tmp)
		return err
	}
	return nil
}
