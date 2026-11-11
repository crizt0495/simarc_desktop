package services

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"arsippro/internal/config"

	"github.com/minio/minio-go/v7"
)

// CloudRefPrefix menandai path berkas digital yang tersimpan di object storage.
// Nilai pada kolom arsip.file_path berbentuk: s3://<bucket>/<key>
const CloudRefPrefix = "s3://"

// DigitalCloudEnabled melaporkan apakah berkas digital harus disimpan di cloud
// (DIGITAL_STORAGE mengizinkan dan kredensial S3 lengkap).
func DigitalCloudEnabled() bool {
	return config.LoadDigitalStorage().DigitalCloudReady()
}

// IsCloudDigitalRef melaporkan apakah file_path menunjuk ke object storage.
func IsCloudDigitalRef(ref string) bool {
	return strings.HasPrefix(strings.TrimSpace(ref), CloudRefPrefix)
}

// DigitalContentType menebak MIME type dari ekstensi berkas.
func DigitalContentType(filename string) string {
	if ct := mime.TypeByExtension(strings.ToLower(filepath.Ext(filename))); ct != "" {
		return ct
	}
	return "application/octet-stream"
}

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

// FetchDigitalCloud mengunduh objek cloud ke folder sementara agar dapat
// dibuka oleh aplikasi default OS. Mengembalikan path lokal hasil unduhan.
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

	// dir: <temp>/simarc-digital/<arsipId>/ supaya nama berkas tidak bertabrakan.
	parts := strings.Split(strings.Trim(key, "/"), "/")
	parent := "umum"
	if len(parts) >= 2 {
		parent = safeSegment(parts[len(parts)-2])
	}
	dir := filepath.Join(os.TempDir(), "simarc-digital", parent)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("gagal membuat folder sementara: %v", err)
	}
	local := filepath.Join(dir, safeSegment(path.Base(key)))
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

// DeleteDigitalCloud menghapus objek cloud yang dirujuk file_path.
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
