package updater

import (
	"os"
	"os/exec"
	"path/filepath"
)

// ApplyResult menjelaskan apa yang terjadi setelah paket dipasang.
type ApplyResult struct {
	// RestartedByUpdater menandakan proses update akan membuka ulang aplikasi
	// sendiri (Windows memakai helper yang menunggu proses lama berhenti).
	// Bila false, pemanggil yang harus memanggil Relaunch().
	RestartedByUpdater bool
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
