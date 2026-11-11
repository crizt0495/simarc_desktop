#!/usr/bin/env bash
# Bangun SATU file installer Windows yang siap kirim:
#   dist/SIMARC-Setup.exe
#
# Prasyarat di Linux:
#   - wails v2 di PATH ($HOME/go/bin)
#   - x86_64-w64-mingw32-gcc (mingw-w64)
#   - Node/npm untuk build frontend
#
# Jalankan dari mana saja:
#   bash scripts/build-windows-setup.sh
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="$PATH:$HOME/go/bin"

echo "▸ Build frontend + aplikasi Windows (wails)…"
wails build -platform windows/amd64 -clean

echo "▸ Siapkan payload installer…"
mkdir -p packaging/winsetup/payload
cp build/bin/SIMARC.exe packaging/winsetup/payload/SIMARC.exe
cp .env packaging/winsetup/payload/.env

echo "▸ Bangun installer satu file…"
rm -f dist/SIMARC-Setup.exe
GOOS=windows CGO_ENABLED=0 \
  go build -tags windows -ldflags "-s -w -H windowsgui" \
  -o dist/SIMARC-Setup.exe ./packaging/winsetup

ls -lh dist/SIMARC-Setup.exe
sha256sum dist/SIMARC-Setup.exe
echo "✓ Selesai — kirim satu file: dist/SIMARC-Setup.exe"
