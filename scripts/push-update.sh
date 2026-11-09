#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# scripts/push-update.sh — commit & push SELURUH proyek ke GitHub.
# Termasuk .env (konfigurasi database) sesuai aturan proyek.
#
# Pemakaian:
#   scripts/push-update.sh "feat: pesan commit"
#   scripts/push-update.sh            # pesan default
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MSG="${1:-update: sinkronisasi perubahan proyek SIMARC}"
BRANCH="${2:-master}"

echo "▸ Menambahkan seluruh perubahan (termasuk .env)…"
git add -A

if git diff --cached --quiet; then
  echo "✓ Tidak ada perubahan untuk di-commit."
else
  echo "▸ Commit: $MSG"
  git commit -m "$MSG"
fi

echo "▸ Push ke origin/$BRANCH…"
git push origin "$BRANCH"
echo "✓ Selesai — seluruh proyek tersimpan di GitHub (origin/$BRANCH)."
