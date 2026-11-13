#!/usr/bin/env bash
# Bangun paket Linux (.deb) + Windows (SIMARC-Setup.exe), lalu publikasikan
# sebagai GitHub Release agar auto-update klien menemukannya.
#
# Pemakaian:
#   scripts/release.sh v1.2.3
#
# Prasyarat:
#   - wails, Go, Node/npm
#   - libwebkit2gtk-4.1-dev + libgtk-3-dev (Linux)
#   - mingw-w64 (x86_64-w64-mingw32-gcc) untuk build Windows
#   - gh (GitHub CLI) yang sudah login: gh auth login
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Pemakaian: scripts/release.sh v1.2.3" >&2
  exit 1
fi
case "$VERSION" in
  v*) ;;
  *) VERSION="v$VERSION" ;;
esac
export SIMARC_VERSION="$VERSION"

echo "▸ Rilis ${VERSION}"
if git rev-parse --git-dir >/dev/null 2>&1; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "⚠ Working tree masih memiliki perubahan yang belum di-commit."
    echo "  Rilis tetap dibangun dari isi working tree saat ini."
  fi
fi

echo "▸ [1/3] Build .deb Linux…"
bash packaging/linux/build-deb.sh

echo "▸ [2/3] Build installer Windows…"
bash scripts/build-windows-setup.sh

echo "▸ [3/3] Checksum & publikasi…"
cd dist
rm -f SHA256SUMS
sha256sum ./*.deb ./SIMARC-Setup.exe > SHA256SUMS

ASSETS=(./*.deb ./SIMARC-Setup.exe ./SHA256SUMS)

if ! command -v gh >/dev/null 2>&1; then
  echo
  echo "✓ Paket siap di dist/. GitHub CLI (gh) tidak ditemukan."
  echo "  Buat rilis manual dengan tag ${VERSION} lalu unggah:"
  printf '    %s\n' "${ASSETS[@]}"
  exit 0
fi

if gh release view "$VERSION" >/dev/null 2>&1; then
  echo "▸ Memperbarui rilis ${VERSION} yang sudah ada…"
  gh release upload "$VERSION" "${ASSETS[@]}" --clobber
else
  echo "▸ Membuat rilis ${VERSION}…"
  gh release create "$VERSION" "${ASSETS[@]}" \
    --title "SIMARC ${VERSION#v}" \
    --generate-notes
fi

echo "✓ Rilis ${VERSION} dipublikasikan."
