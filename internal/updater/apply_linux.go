//go:build linux

package updater

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// Apply memasang paket pembaruan di Linux.
//
//   - .deb  → dpkg -i (root, lewat pkexec/sudo bila perlu)
//   - biner/AppImage → ganti executable di tempat (tanpa root)
//
// Setelah berhasil, pemanggil harus memanggil Relaunch().
func Apply(path, assetName string) (ApplyResult, error) {
	ext := strings.ToLower(filepath.Ext(path))
	switch {
	case ext == ".deb":
		if err := installDeb(path); err != nil {
			return ApplyResult{}, err
		}
		os.Remove(path)
		os.Remove(filepath.Dir(path))
		return ApplyResult{}, nil
	case ext == ".appimage" || ext == "":
		if err := replaceExecutable(path); err != nil {
			return ApplyResult{}, fmt.Errorf("gagal mengganti biner aplikasi: %w", err)
		}
		os.Remove(path)
		os.Remove(filepath.Dir(path))
		return ApplyResult{}, nil
	default:
		return ApplyResult{}, fmt.Errorf("format paket %q belum didukung untuk Linux", assetName)
	}
}

func installDeb(path string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	if os.Geteuid() == 0 {
		return runPackageCommand(ctx, "dpkg", "-i", path)
	}
	if _, err := exec.LookPath("pkexec"); err == nil {
		return runPackageCommand(ctx, "pkexec", "dpkg", "-i", path)
	}
	if _, err := exec.LookPath("sudo"); err == nil {
		return runPackageCommand(ctx, "sudo", "-n", "dpkg", "-i", path)
	}
	return fmt.Errorf("memasang .deb membutuhkan hak administrator, tetapi pkexec/sudo tidak tersedia — jalankan manual: sudo dpkg -i %s", path)
}

func runPackageCommand(ctx context.Context, name string, args ...string) error {
	out, err := exec.CommandContext(ctx, name, args...).CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		if ctx.Err() != nil {
			msg = "waktu pemasangan habis"
		}
		return fmt.Errorf("pemasangan paket gagal: %s", msg)
	}
	return nil
}
