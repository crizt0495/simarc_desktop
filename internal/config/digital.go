package config

import (
	"os"
	"strings"
)

// DigitalStorage menentukan di mana berkas digital arsip disimpan.
//
//	Backend dipilih dari DIGITAL_STORAGE:
//	  - "auto" (default): S3 bila kredensial lengkap, lalu rclone bila remote
//	    tersedia, selain itu lokal.
//	  - "local"          : selalu disk perangkat.
//	  - "s3"/"cloud"     : wajib object storage S3-compatible.
//	  - "rclone"         : wajib remote rclone (mis. Google Drive).
type DigitalStorage struct {
	// Mode adalah nilai mentah DIGITAL_STORAGE: auto | local | s3 | rclone.
	Mode string
	// UseS3 bernilai true bila kredensial S3 lengkap.
	UseS3 bool
	// S3 berisi kredensial endpoint/bucket yang dipakai.
	S3 OffsiteConfig
	// Prefix adalah folder dasar objek digital di dalam bucket.
	Prefix string
	// RcloneRemote adalah nama remote rclone (mis. "gdrive").
	RcloneRemote string
	// RclonePath adalah folder dasar di dalam remote.
	RclonePath string
}

// LoadDigitalStorage memetakan pengaturan penyimpanan berkas digital.
//
//	Kredensial S3 diambil dari DIGITAL_S3_* bila diisi; jika kosong memakai
//	OFFSITE_S3_*. Remote rclone diambil dari DIGITAL_RCLONE_REMOTE, lalu
//	OFFSITE_RCLONE_REMOTE.
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

	prefix := strings.Trim(off.S3Prefix, "/")
	if prefix == "" {
		prefix = "simarc"
	}

	rcloneRemote := strings.TrimSpace(os.Getenv("DIGITAL_RCLONE_REMOTE"))
	if rcloneRemote == "" {
		rcloneRemote = strings.TrimRight(strings.TrimSpace(off.RcloneRemote), ":")
	}
	rclonePath := strings.Trim(strings.TrimSpace(os.Getenv("DIGITAL_RCLONE_PATH")), "/")
	if rclonePath == "" {
		rclonePath = "simarc-digital"
	}

	return DigitalStorage{
		Mode:         mode,
		UseS3:        off.S3Ready(),
		S3:           off,
		Prefix:       prefix + "/digital",
		RcloneRemote: rcloneRemote,
		RclonePath:   rclonePath,
	}
}

// DigitalCloudReady melaporkan apakah kredensial S3 lengkap.
func (d DigitalStorage) DigitalCloudReady() bool {
	return d.UseS3 && d.S3.S3Ready()
}

// RcloneConfigured melaporkan apakah nama remote rclone sudah diisi.
func (d DigitalStorage) RcloneConfigured() bool {
	return strings.TrimSpace(d.RcloneRemote) != ""
}

// CloudRequested melaporkan apakah pengguna secara eksplisit memilih backend
// cloud, sehingga konfigurasi yang belum lengkap harus dilaporkan sebagai
// kesalahan (bukan diam-diam disimpan ke disk).
func (d DigitalStorage) CloudRequested() bool {
	switch d.Mode {
	case "s3", "cloud", "r2", "aws", "minio", "b2", "rclone", "gdrive", "drive":
		return true
	}
	return false
}

// S3Requested melaporkan apakah mode meminta backend S3.
func (d DigitalStorage) S3Requested() bool {
	switch d.Mode {
	case "s3", "cloud", "r2", "aws", "minio", "b2":
		return true
	}
	return false
}

// RcloneRequested melaporkan apakah mode meminta backend rclone.
func (d DigitalStorage) RcloneRequested() bool {
	switch d.Mode {
	case "rclone", "gdrive", "drive":
		return true
	}
	return false
}
