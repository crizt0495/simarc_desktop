package services

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
)

// fakeS3 adalah server S3-compatible minimal untuk pengujian offline:
// PUT/GET/HEAD/DELETE objek dengan path-style, plus bucket location.
type fakeS3 struct {
	mu      sync.Mutex
	objects map[string][]byte
}

func (f *fakeS3) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()

	p := strings.TrimPrefix(r.URL.Path, "/")
	parts := strings.SplitN(p, "/", 2)
	bucket := parts[0]
	key := ""
	if len(parts) > 1 {
		key = parts[1]
	}

	// Bucket-level requests (BucketExists / GetBucketLocation).
	if key == "" {
		if _, ok := r.URL.Query()["location"]; ok {
			w.Header().Set("Content-Type", "application/xml")
			io.WriteString(w, `<?xml version="1.0" encoding="UTF-8"?><LocationConstraint xmlns="http://s3.amazonaws.com/doc/2006-03-01/">us-east-1</LocationConstraint>`)
			return
		}
		if r.Method == http.MethodHead || r.Method == http.MethodGet || r.Method == http.MethodPut {
			w.WriteHeader(http.StatusOK)
			return
		}
	}

	if bucket != "test-bucket" {
		http.Error(w, "NoSuchBucket", http.StatusNotFound)
		return
	}
	if key == "" {
		http.Error(w, "NoSuchKey", http.StatusNotFound)
		return
	}
	if f.objects == nil {
		f.objects = map[string][]byte{}
	}

	switch r.Method {
	case http.MethodPut:
		data, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if strings.Contains(r.Header.Get("Content-Encoding"), "aws-chunked") || r.Header.Get("X-Amz-Decoded-Content-Length") != "" {
			if decoded, decErr := decodeAWSChunked(data); decErr == nil {
				data = decoded
			}
		}
		f.objects[key] = data
		sum := md5.Sum(data)
		w.Header().Set("ETag", `"`+hex.EncodeToString(sum[:])+`"`)
		w.WriteHeader(http.StatusOK)
	case http.MethodGet, http.MethodHead:
		data, ok := f.objects[key]
		if !ok {
			http.Error(w, "NoSuchKey", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Length", fmt.Sprint(len(data)))
		sum := md5.Sum(data)
		w.Header().Set("ETag", `"`+hex.EncodeToString(sum[:])+`"`)
		w.Header().Set("Last-Modified", "Mon, 02 Jan 2006 15:04:05 GMT")
		w.WriteHeader(http.StatusOK)
		if r.Method == http.MethodGet {
			w.Write(data)
		}
	case http.MethodDelete:
		delete(f.objects, key)
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// decodeAWSChunked membuka payload PUT ber-encoding aws-chunked
// (<hex-size>;chunk-signature=...\r\n<data>\r\n ... 0;chunk-signature=...\r\n\r\n).
func decodeAWSChunked(raw []byte) ([]byte, error) {
	var out []byte
	rest := raw
	for {
		i := strings.Index(string(rest), "\r\n")
		if i < 0 {
			return nil, fmt.Errorf("chunk rusak")
		}
		head := string(rest[:i])
		rest = rest[i+2:]
		sizeStr := head
		if j := strings.Index(sizeStr, ";"); j >= 0 {
			sizeStr = sizeStr[:j]
		}
		var size int
		if _, err := fmt.Sscanf(sizeStr, "%x", &size); err != nil {
			return nil, err
		}
		if size == 0 {
			return out, nil
		}
		if len(rest) < size+2 {
			return nil, fmt.Errorf("chunk terpotong")
		}
		out = append(out, rest[:size]...)
		rest = rest[size+2:]
	}
}

func TestDigitalCloudRoundTrip(t *testing.T) {
	fake := &fakeS3{objects: map[string][]byte{}}
	srv := httptest.NewServer(fake)
	defer srv.Close()

	t.Setenv("DIGITAL_STORAGE", "s3")
	t.Setenv("OFFSITE_S3_ENDPOINT", srv.URL)
	t.Setenv("OFFSITE_S3_REGION", "us-east-1")
	t.Setenv("OFFSITE_S3_BUCKET", "test-bucket")
	t.Setenv("OFFSITE_S3_ACCESS_KEY", "test-key")
	t.Setenv("OFFSITE_S3_SECRET_KEY", "test-secret")
	t.Setenv("OFFSITE_S3_PATH_STYLE", "true")
	t.Setenv("OFFSITE_S3_PREFIX", "simarc")
	t.Setenv("DIGITAL_S3_BUCKET", "")
	t.Setenv("DIGITAL_S3_ENDPOINT", "")
	t.Setenv("DIGITAL_S3_ACCESS_KEY", "")
	t.Setenv("DIGITAL_S3_SECRET_KEY", "")

	if !DigitalCloudEnabled() {
		t.Fatal("DigitalCloudEnabled() = false, padahal kredensial S3 test lengkap")
	}

	payload := []byte("isi berkas digital uji")
	ref, err := SaveDigitalCloud("arsip-123", "surat.pdf", payload, "application/pdf")
	if err != nil {
		t.Fatalf("SaveDigitalCloud: %v", err)
	}
	wantRef := "s3://test-bucket/simarc/digital/arsip-123/surat.pdf"
	if ref != wantRef {
		t.Fatalf("ref = %q, ingin %q", ref, wantRef)
	}
	if !IsCloudDigitalRef(ref) {
		t.Fatal("IsCloudDigitalRef(ref) = false")
	}
	if got := fake.objects["simarc/digital/arsip-123/surat.pdf"]; string(got) != string(payload) {
		t.Fatalf("objek tersimpan = %q", got)
	}

	local, err := FetchDigitalCloud(ref)
	if err != nil {
		t.Fatalf("FetchDigitalCloud: %v", err)
	}
	defer os.Remove(local)
	got, err := os.ReadFile(local)
	if err != nil {
		t.Fatalf("baca berkas unduhan: %v", err)
	}
	if string(got) != string(payload) {
		t.Fatalf("isi unduhan = %q, ingin %q", got, payload)
	}

	if err := DeleteDigitalCloud(ref); err != nil {
		t.Fatalf("DeleteDigitalCloud: %v", err)
	}
	if _, ok := fake.objects["simarc/digital/arsip-123/surat.pdf"]; ok {
		t.Fatal("objek masih ada setelah DeleteDigitalCloud")
	}
	if _, err := FetchDigitalCloud(ref); err == nil {
		t.Fatal("FetchDigitalCloud seharusnya gagal setelah objek dihapus")
	}
}

func TestDigitalLocalByDefault(t *testing.T) {
	t.Setenv("DIGITAL_STORAGE", "local")
	t.Setenv("OFFSITE_S3_ENDPOINT", "")
	t.Setenv("OFFSITE_S3_BUCKET", "")
	t.Setenv("OFFSITE_S3_ACCESS_KEY", "")
	t.Setenv("OFFSITE_S3_SECRET_KEY", "")
	t.Setenv("DIGITAL_S3_ENDPOINT", "")
	t.Setenv("DIGITAL_S3_BUCKET", "")
	t.Setenv("DIGITAL_S3_ACCESS_KEY", "")
	t.Setenv("DIGITAL_S3_SECRET_KEY", "")
	if DigitalCloudEnabled() {
		t.Fatal("DigitalCloudEnabled() = true padahal mode local / tanpa kredensial")
	}
}
