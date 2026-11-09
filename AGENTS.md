# AGENTS.md — Aturan Kerja Proyek SIMARC Desktop

## Aturan wajib setiap ada pembaruan

1. **Push seluruh proyek 100% ke GitHub** setiap kali ada perubahan.
   - Remote: `origin` → `git@github.com:crizt0495/simarc_desktop.git`
   - Branch: `master`
   - Termasuk **konfigurasi database (`.env`)**: file `.env` sengaja di-*un-ignore* di `.gitignore` dan **harus ikut di-commit serta di-push** (permintaan eksplisit pemilik proyek).
   - Jangan meninggalkan perubahan yang belum di-commit/di-push setelah tugas selesai.

2. **Selalu verifikasi sebelum push**
   ```bash
   go build ./...
   cd frontend && npx tsc --noEmit && npm run build
   ```

3. **Push cepat** (commit semua + push):
   ```bash
   scripts/push-update.sh "pesan commit"
   ```

4. **Build & install desktop (Linux)**
   ```bash
   export PATH="$PATH:$HOME/go/bin"
   bash packaging/linux/build-deb.sh
   pkexec dpkg --install "$PWD/dist/simarc_1.0.0-1_amd64.deb"
   ```

## Catatan penting

- Repo GitHub bersifat **publik**. Sesuai keputusan pemilik, kredensial database di `.env` tetap di-push apa adanya. Jika visibilitas repo berubah atau kredensial dirotasi, perbarui `.env` dan push ulang.
- Aplikasi terpasang membaca `~/.env` (di luar repo, mode `0600`).
- Jangan pernah menampilkan isi kredensial (password/host DB) di jawaban chat atau log publik.
- UI aplikasi menggunakan Bahasa Indonesia; pertahankan pola desain dan komponen yang sudah ada.
- Jangan menambahkan placeholder / toast "menyusul"; semua modul harus berfungsi nyata (backend + frontend).
