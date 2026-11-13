# Auto-Update SIMARC

Aplikasi desktop memeriksa, mengunduh, dan memasang pembaruan sendiri dari
**GitHub Releases**. Pengguna tetap melihat konfirmasi sebelum pemasangan.

## Alur

```
aplikasi start
  └─ GET /repos/crizt0495/simarc_desktop/releases/latest   (4 detik setelah start)
       ├─ tidak ada rilis / versi sama  → diam
       └─ versi lebih baru
            └─ banner "Pembaruan tersedia" (kanan bawah)
                 └─ klik "Perbarui sekarang"
                      ├─ unduh aset sesuai OS/arsitektur
                      ├─ verifikasi SHA-256
                      └─ pasang + buka ulang aplikasi
```

Pemeriksaan diulang setiap 6 jam. Tombol **Pengaturan → Pembaruan** menyediakan
pemeriksaan manual dan menampilkan catatan rilis.

Kode terkait:

| Berkas | Peran |
|---|---|
| `internal/updater/updater.go` | ambil rilis, pilih aset, bandingkan versi, unduh + checksum |
| `internal/updater/apply_linux.go` | pasang `.deb` (pkexec/sudo) atau ganti biner |
| `internal/updater/apply_windows.go` | helper batch yang menunggu aplikasi keluar lalu menjalankan installer |
| `frontend/src/components/UpdateBanner.tsx` | banner global |
| `frontend/src/pages/PengaturanPage.tsx` | tab "Pembaruan" |

## Versi

Versi aplikasi di-inject saat build:

```bash
go build -ldflags "-X main.appVersion=1.2.3"
wails build -ldflags "-X main.appVersion=1.2.3"
```

Skrip build (`packaging/linux/build-deb.sh`, `scripts/build-windows-setup.sh`)
mengambil versi dari `scripts/version.sh`:

1. `SIMARC_VERSION` (env) — dipakai rilis/CI
2. `git describe --tags --always --dirty`
3. `1.0.0`

`SIMARC_VERSION` di `.env` juga bisa menimpa versi yang dilaporkan (berguna
untuk pengujian).

## Membuat rilis

### Otomatis (GitHub Actions)

```bash
git tag v1.2.3
git push origin v1.2.3
```

Workflow `.github/workflows/release.yml` membangun `.deb` (Linux) dan
`SIMARC-Setup.exe` (Windows), membuat `SHA256SUMS`, lalu mempublikasikan
GitHub Release. Aset ini yang diunduh klien.

### Manual

```bash
scripts/release.sh v1.2.3
```

Butuh `gh` yang sudah login (`gh auth login`) dan `mingw-w64` untuk build
Windows. Tanpa `gh`, paket tetap dibuat di `dist/` untuk diunggah manual.

## Perilaku per platform

| Platform | Aset | Cara pasang |
|---|---|---|
| Linux amd64 | `simarc_<versi>_amd64.deb` | `pkexec dpkg -i` (muncul dialog sandi). Jika aplikasi dijalankan dari biner biasa/AppImage, biner diganti langsung tanpa root |
| Windows amd64 | `SIMARC-Setup.exe` | Aplikasi membuat skrip batch yang menunggu proses lama berhenti, menjalankan installer `-norun`, lalu membuka aplikasi lagi |
| macOS | `.dmg`/`.zip` | Belum otomatis — pesan untuk memasang manual |

Installer **tidak menimpa** `.env` dan `storage/`; database TiDB Cloud dan
berkas arsip tidak terpengaruh. Perubahan skema database tetap dijalankan
otomatis oleh migrasi saat aplikasi versi baru start.

## Keamanan

- Semua unduhan lewat HTTPS.
- Paket diverifikasi terhadap `digest` aset GitHub atau berkas `SHA256SUMS`.
  Unduhan ditolak bila checksum tidak cocok.
- Pemasangan selalu melalui konfirmasi pengguna.
- `SIMARC_UPDATE_URL` hanya mengubah sumber metadata rilis; URL unduhan tetap
  diambil dari metadata tersebut. Arahkan hanya ke server yang dipercaya.

## Keterbatasan

- Rilis pertama yang memuat fitur ini harus dipasang manual sekali
  (*bootstrap*). Setelah itu pembaruan berjalan otomatis.
- Di Linux, pemasangan `.deb` membutuhkan polkit agent (`pkexec`) atau sudo
  non-interaktif. Untuk update tanpa sandi, gunakan AppImage atau instalasi
  per-user.
- Repo harus memiliki minimal satu rilis non-draft/non-prerelease. Selama
  belum ada rilis, aplikasi hanya menampilkan "belum ada rilis pembaruan".
- Rate limit GitHub API untuk permintaan tanpa token adalah 60/jam per IP;
  pemeriksaan setiap 6 jam jauh di bawah batas tersebut.

## Uji cepat tanpa rilis

Arahkan `SIMARC_UPDATE_URL` ke server lokal yang mengembalikan JSON ala GitHub:

```json
{
  "tag_name": "v9.9.9",
  "draft": false,
  "prerelease": false,
  "assets": [
    {
      "name": "simarc_9.9.9_amd64.deb",
      "browser_download_url": "http://localhost:8000/simarc_9.9.9_amd64.deb",
      "size": 123,
      "digest": "sha256:<64 hex>"
    }
  ]
}
```

Jalankan `python3 -m http.server` di folder yang sama, set variabel, lalu buka
aplikasi. Tab **Pengaturan → Pembaruan** akan menampilkan rilis palsu tersebut.
