package services

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"time"

	"arsippro/internal/config"

	"github.com/minio/minio-go/v7"
)

// Referensi path berkas digital di object storage / remote rclone:
//
//	s3://<bucket>/<key>
//	rclone://<remote>/<path>
const (
	CloudRefPrefix  = "s3://"
	RcloneRefPrefix = "rclone://"

	backendLocal  = "local"
	backendS3     = "s3"
	backendRclone = "rclone"
)

// DigitalCloudEnabled melaporkan apakah kredensial S3 lengkap (backend S3).
func DigitalCloudEnabled() bool {
	return config.LoadDigitalStorage().DigitalCloudReady()
}

// RcloneAvailable melaporkan apakah biner rclone tersedia di PATH.
func RcloneAvailable() bool {
	_, err := exec.LookPath("rclone")
	return err == nil
}

// DigitalBackendName menentukan backend aktif: "s3", "rclone", atau "local".
// Mengembalikan error bila pengguna memilih backend cloud yang belum siap.
func DigitalBackendName() (string, error) {
	ds := config.LoadDigitalStorage()
	switch {
	case ds.Mode == "local" || ds.Mode == "lokal" || ds.Mode == "disk" || ds.Mode == "off":
		return backendLocal, nil
	case ds.S3Requested():
		if ds.DigitalCloudReady() {
			return backendS3, nil
		}
		return "", fmt.Errorf("DIGITAL_STORAGE=%s tetapi kredensial S3 belum lengkap — isi Object Storage pada menu Integrasi", ds.Mode)
	case ds.RcloneRequested():
		if !ds.RcloneConfigured() {
			return "", fmt.Errorf("DIGITAL_STORAGE=%s tetapi DIGITAL_RCLONE_REMOTE belum diisi", ds.Mode)
		}
		if !RcloneAvailable() {
			return "", fmt.Errorf("rclone tidak ditemukan di PATH — pasang rclone atau pilih penyimpanan lokal/S3")
		}
		return backendRclone, nil
	}

	// auto: S3 → rclone → lokal.
	if ds.DigitalCloudReady() {
		return backendS3, nil
	}
	if ds.RcloneConfigured() && RcloneAvailable() {
		return backendRclone, nil
	}
	return backendLocal, nil
}

// IsCloudDigitalRef melaporkan apakah file_path menunjuk ke penyimpanan cloud
// (S3 maupun rclone).
func IsCloudDigitalRef(ref string) bool {
	ref = strings.TrimSpace(ref)
	return strings.HasPrefix(ref, CloudRefPrefix) || strings.HasPrefix(ref, RcloneRefPrefix)
}

// DigitalContentType menebak MIME type dari ekstensi berkas.
func DigitalContentType(filename string) string {
	if ct := mime.TypeByExtension(strings.ToLower(filepath.Ext(filename))); ct != "" {
		return ct
	}
	return "application/octet-stream"
}

// SaveDigitalToCloud menyimpan berkas ke backend cloud aktif (S3 atau rclone).
func SaveDigitalToCloud(arsipID, filename string, data []byte) (string, error) {
	backend, err := DigitalBackendName()
	if err != nil {
		return "", err
	}
	switch backend {
	case backendS3:
		return SaveDigitalCloud(arsipID, filename, data, DigitalContentType(filename))
	case backendRclone:
		return SaveDigitalRclone(arsipID, filename, data)
	}
	return "", fmt.Errorf("backend cloud tidak aktif")
}

// ── S3-compatible ───────────────────────────────────────────────────────────

// SaveDigitalCloud mengunggah berkas digital arsip ke bucket S3-compatible.
// Mengembalikan referensi s3://bucket/key yang disimpan di kolom file_path.
func SaveDigitalCloud(arsipID, filename string, data []byte, contentType string) (string, error) {
	cfg := config.LoadDigitalStorage()
	if !cfg.DigitalCloudReady() {
		return "", fmt.Errorf("penyimpanan cloud belum dikonfigurasi (isi endpoint, bucket, access key, dan secret key pada menu Integrasi)")
	}
	cl, err := newS3Client(cfg.S3)
	if err != nil {
		return "", err
	}
	if contentType == "" {
		contentType = DigitalContentType(filename)
	}
	key := path.Join(cfg.Prefix, safeSegment(arsipID), safeSegment(filepath.Base(filename)))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	_, err = cl.PutObject(ctx, cfg.S3.S3Bucket, key, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", fmt.Errorf("gagal mengunggah berkas ke cloud: %v", err)
	}
	return CloudRefPrefix + cfg.S3.S3Bucket + "/" + key, nil
}

// FetchDigitalCloud mengunduh objek S3 ke folder sementara agar dapat dibuka
// oleh aplikasi default OS. Mengembalikan path lokal hasil unduhan.
func FetchDigitalCloud(ref string) (string, error) {
	bucket, key, err := parseCloudRef(ref)
	if err != nil {
		return "", err
	}
	cfg := config.LoadDigitalStorage()
	if !cfg.S3.S3Ready() {
		return "", fmt.Errorf("konfigurasi object storage tidak ditemukan")
	}
	cl, err := newS3Client(cfg.S3)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	obj, err := cl.GetObject(ctx, bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return "", fmt.Errorf("gagal mengambil berkas dari cloud: %v", err)
	}
	defer obj.Close()

	local := tempDigitalPath(key)
	if err := os.MkdirAll(filepath.Dir(local), 0755); err != nil {
		return "", fmt.Errorf("gagal membuat folder sementara: %v", err)
	}
	f, err := os.Create(local)
	if err != nil {
		return "", fmt.Errorf("gagal menyiapkan berkas sementara: %v", err)
	}
	if _, err := io.Copy(f, obj); err != nil {
		f.Close()
		_ = os.Remove(local)
		return "", fmt.Errorf("gagal mengunduh berkas: %v", err)
	}
	if err := f.Close(); err != nil {
		return "", err
	}
	return local, nil
}

// DeleteDigitalCloud menghapus objek S3 yang dirujuk file_path.
func DeleteDigitalCloud(ref string) error {
	bucket, key, err := parseCloudRef(ref)
	if err != nil {
		return err
	}
	cfg := config.LoadDigitalStorage()
	if !cfg.S3.S3Ready() {
		return fmt.Errorf("konfigurasi object storage tidak ditemukan")
	}
	cl, err := newS3Client(cfg.S3)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	return cl.RemoveObject(ctx, bucket, key, minio.RemoveObjectOptions{})
}

// ── rclone (Google Drive / OneDrive / Dropbox / …) ──────────────────────────

// SaveDigitalRclone menyalin berkas ke remote rclone yang terkonfigurasi.
func SaveDigitalRclone(arsipID, filename string, data []byte) (string, error) {
	ds := config.LoadDigitalStorage()
	if !ds.RcloneConfigured() {
		return "", fmt.Errorf("remote rclone belum diatur (DIGITAL_RCLONE_REMOTE)")
	}
	remote := strings.TrimRight(strings.TrimSpace(ds.RcloneRemote), ":")
	key := path.Join(ds.RclonePath, safeSegment(arsipID), safeSegment(filepath.Base(filename)))
	dest := remote + ":" + key

	tmp, err := os.CreateTemp("", "simarc-rclone-*")
	if err != nil {
		return "", fmt.Errorf("gagal menyiapkan berkas sementara: %v", err)
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return "", fmt.Errorf("gagal menulis berkas sementara: %v", err)
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}

	if err := runRclone("copyto", tmpName, dest); err != nil {
		return "", err
	}
	return RcloneRefPrefix + remote + "/" + key, nil
}

// FetchDigitalRclone mengunduh berkas dari remote rclone ke folder sementara.
func FetchDigitalRclone(ref string) (string, error) {
	remote, key, err := parseRcloneRef(ref)
	if err != nil {
		return "", err
	}
	local := tempDigitalPath(key)
	if err := os.MkdirAll(filepath.Dir(local), 0755); err != nil {
		return "", fmt.Errorf("gagal membuat folder sementara: %v", err)
	}
	if err := runRclone("copyto", remote+":"+key, local); err != nil {
		return "", err
	}
	return local, nil
}

// DeleteDigitalRclone menghapus berkas pada remote rclone.
func DeleteDigitalRclone(ref string) error {
	remote, key, err := parseRcloneRef(ref)
	if err != nil {
		return err
	}
	return runRclone("deletefile", remote+":"+key)
}

// FetchDigitalCloudAny mengunduh berkas dari referensi cloud mana pun.
func FetchDigitalCloudAny(ref string) (string, error) {
	ref = strings.TrimSpace(ref)
	switch {
	case strings.HasPrefix(ref, CloudRefPrefix):
		return FetchDigitalCloud(ref)
	case strings.HasPrefix(ref, RcloneRefPrefix):
		return FetchDigitalRclone(ref)
	}
	return "", fmt.Errorf("referensi cloud tidak dikenal: %q", ref)
}

// DeleteDigitalCloudAny menghapus berkas dari referensi cloud mana pun.
func DeleteDigitalCloudAny(ref string) error {
	ref = strings.TrimSpace(ref)
	switch {
	case strings.HasPrefix(ref, CloudRefPrefix):
		return DeleteDigitalCloud(ref)
	case strings.HasPrefix(ref, RcloneRefPrefix):
		return DeleteDigitalRclone(ref)
	}
	return fmt.Errorf("referensi cloud tidak dikenal: %q", ref)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// runRclone menjalankan perintah rclone dengan batas waktu.
func runRclone(args ...string) error {
	if !RcloneAvailable() {
		return fmt.Errorf("rclone tidak ditemukan di PATH")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, "rclone", args...)
	cmd.Stdout = nil
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("rclone %s gagal: %s", args[0], msg)
	}
	return nil
}

// tempDigitalPath menentukan path unduhan sementara untuk sebuah key cloud.
func tempDigitalPath(key string) string {
	parts := strings.Split(strings.Trim(key, "/"), "/")
	parent := "umum"
	if len(parts) >= 2 {
		parent = safeSegment(parts[len(parts)-2])
	}
	base := safeSegment(path.Base(key))
	return filepath.Join(os.TempDir(), "simarc-digital", parent, base)
}

// parseCloudRef memecah s3://bucket/key menjadi bucket dan key.
func parseCloudRef(ref string) (string, string, error) {
	ref = strings.TrimSpace(ref)
	if !strings.HasPrefix(ref, CloudRefPrefix) {
		return "", "", fmt.Errorf("referensi cloud tidak valid: %q", ref)
	}
	s := strings.TrimPrefix(ref, CloudRefPrefix)
	i := strings.Index(s, "/")
	if i <= 0 || i == len(s)-1 {
		return "", "", fmt.Errorf("referensi cloud tidak lengkap: %q", ref)
	}
	return s[:i], s[i+1:], nil
}

// parseRcloneRef memecah rclone://remote/path menjadi remote dan path.
func parseRcloneRef(ref string) (string, string, error) {
	ref = strings.TrimSpace(ref)
	if !strings.HasPrefix(ref, RcloneRefPrefix) {
		return "", "", fmt.Errorf("referensi rclone tidak valid: %q", ref)
	}
	s := strings.TrimPrefix(ref, RcloneRefPrefix)
	i := strings.Index(s, "/")
	if i <= 0 || i == len(s)-1 {
		return "", "", fmt.Errorf("referensi rclone tidak lengkap: %q", ref)
	}
	remote := strings.TrimRight(s[:i], ":")
	key := strings.TrimPrefix(s[i+1:], "/")
	if remote == "" || key == "" {
		return "", "", fmt.Errorf("referensi rclone tidak lengkap: %q", ref)
	}
	return remote, key, nil
}

// safeSegment membersihkan satu segmen path agar tidak keluar dari folder.
func safeSegment(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.ReplaceAll(s, "\\", "_")
	s = strings.ReplaceAll(s, "..", "_")
	if s == "" || s == "." {
		return "berkas"
	}
	return s
}
