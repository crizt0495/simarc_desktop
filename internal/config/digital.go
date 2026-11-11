package config

import (
	"os"
	"strings"
)

// DigitalStorage menentukan di mana berkas digital arsip disimpan.
//
//	S3 == true  → object storage S3-compatible (Cloudflare R2/B2/MinIO/S3)
//	S3 == false → disk lokal perangkat (perilaku lama)
//
// Konfigurasi dibaca ulang setiap kali dipakai, sehingga perubahan .env
// langsung berlaku tanpa restart.
type DigitalStorage struct {
	// Mode adalah nilai mentah DIGITAL_STORAGE: auto | local | s3.
	Mode string
	// UseS3 bernilai true bila berkas digital harus disimpan di cloud.
	UseS3 bool
	// S3 berisi kredensial endpoint/bucket yang dipakai.
	S3 OffsiteConfig
	// Prefix adalah folder dasar objek digital di dalam bucket.
	Prefix string
}

// LoadDigitalStorage memetakan pengaturan penyimpanan berkas digital.
//
//	Kredensial diambil dari DIGITAL_S3_* bila diisi; jika kosong, memakai
//	OFFSITE_S3_* (konfigurasi Object Storage pada menu Integrasi).
//
//	DIGITAL_STORAGE:
//	  - "auto" (default): cloud bila kredensial S3 lengkap, selain itu lokal.
//	  - "local"          : selalu simpan di disk perangkat.
//	  - "s3"/"cloud"     : wajib cloud (gagal bila kredensial belum lengkap).
func LoadDigitalStorage() DigitalStorage {
	off := LoadOffsite()

	// Override khusus berkas digital (opsional).
	if v := strings.TrimSpace(os.Getenv("DIGITAL_S3_ENDPOINT")); v != "" {
		off.S3Endpoint = v
	}
	if v := strings.TrimSpace(os.Getenv("DIGITAL_S3_REGION")); v != "" {
		off.S3Region = v
	}
	if v := strings.TrimSpace(os.Getenv("DIGITAL_S3_BUCKET")); v != "" {
		off.S3Bucket = v
	}
	if v := strings.TrimSpace(os.Getenv("DIGITAL_S3_ACCESS_KEY")); v != "" {
		off.S3AccessKey = v
	}
	if v := strings.TrimSpace(os.Getenv("DIGITAL_S3_SECRET_KEY")); v != "" {
		off.S3SecretKey = v
	}
	if v := strings.TrimSpace(os.Getenv("DIGITAL_S3_PREFIX")); v != "" {
		off.S3Prefix = v
	}
	if v := strings.TrimSpace(os.Getenv("DIGITAL_S3_PATH_STYLE")); v != "" {
		off.S3PathStyle = getBoolEnv("DIGITAL_S3_PATH_STYLE", off.S3PathStyle)
	}

	mode := strings.ToLower(strings.TrimSpace(os.Getenv("DIGITAL_STORAGE")))
	if mode == "" {
		mode = "auto"
	}

	useS3 := off.S3Ready()
	switch mode {
	case "local", "lokal", "disk", "off":
		useS3 = false
	case "s3", "cloud", "r2", "aws", "minio", "b2":
		// Tetap useS3 = S3Ready(); pemanggil akan menampilkan pesan bila kosong.
	}

	prefix := strings.Trim(off.S3Prefix, "/")
	if prefix == "" {
		prefix = "simarc"
	}

	return DigitalStorage{
		Mode:   mode,
		UseS3:  useS3,
		S3:     off,
		Prefix: prefix + "/digital",
	}
}

// DigitalCloudReady melaporkan apakah mode cloud dipilih DAN kredensial lengkap.
func (d DigitalStorage) DigitalCloudReady() bool {
	return d.UseS3 && d.S3.S3Ready()
}

// CloudRequested melaporkan apakah pengguna secara eksplisit memilih cloud,
// sehingga kredensial yang belum lengkap harus dilaporkan sebagai kesalahan
// (bukan diam-diam disimpan ke disk).
func (d DigitalStorage) CloudRequested() bool {
	switch d.Mode {
	case "s3", "cloud", "r2", "aws", "minio", "b2":
		return true
	}
	return false
}
