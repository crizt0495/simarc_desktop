#!/usr/bin/env bash
# Cetak versi aplikasi untuk build saat ini.
#
# Urutan:
#   1. SIMARC_VERSION (env) — dipakai CI / rilis manual
#   2. tag git terdekat + jumlah commit sejak tag (git describe)
#   3. 1.0.0 bila repo belum punya tag
#
# Contoh keluaran:
#   v1.2.3 (tag bersih)            → 1.2.3
#   5 commit setelah v1.2.3        → 1.2.3-5-gabc1234
#   working tree kotor             → 1.2.3-5-gabc1234-dirty
#   belum ada tag                  → 1.0.0-0-gabc1234
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -n "${SIMARC_VERSION:-}" ]; then
  echo "${SIMARC_VERSION#v}"
  exit 0
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "1.0.0"
  exit 0
fi

TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
DIRTY=""
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  DIRTY="-dirty"
fi

if [ -z "$TAG" ]; then
  echo "1.0.0-0-g${SHA}${DIRTY}"
  exit 0
fi

BASE="${TAG#v}"
COUNT="$(git rev-list --count "${TAG}..HEAD" 2>/dev/null || echo 0)"
if [ "$COUNT" = "0" ] && [ -z "$DIRTY" ]; then
  echo "$BASE"
else
  echo "${BASE}-${COUNT}-g${SHA}${DIRTY}"
fi
