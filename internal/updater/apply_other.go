//go:build !linux && !windows

package updater

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Apply memasang pembaruan pada platform lain (mis. macOS). Hanya biner/zip
// yang berisi executable tunggal yang dapat diganti otomatis; paket .dmg
// harus dipasang manual.
func Apply(path, assetName string) (ApplyResult, error) {
	ext := strings.ToLower(filepath.Ext(path))
	if ext == ".dmg" || ext == ".zip" || ext == ".pkg" {
		return ApplyResult{}, fmt.Errorf("paket %q harus dipasang manual di platform ini", assetName)
	}
	if err := replaceExecutable(path); err != nil {
		return ApplyResult{}, fmt.Errorf("gagal mengganti biner aplikasi: %w", err)
	}
	os.Remove(path)
	os.Remove(filepath.Dir(path))
	return ApplyResult{}, nil
}
