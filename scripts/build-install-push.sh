#!/bin/bash
set -e
cd /home/chris/Documents/aplikasi/simarc-dekstop

echo "=== 1. Build frontend ==="
(cd frontend && npx tsc --noEmit && npx vite build)

echo "=== 2. Build Go binary ==="
go build -ldflags="-s -w" -o /tmp/opencode/simarc-desktop ./
cp /tmp/opencode/simarc-desktop /home/chris/.local/share/simarc/simarc-desktop
chmod +x /home/chris/.local/share/simarc/simarc-desktop
cp /tmp/opencode/simarc-desktop /home/chris/.local/bin/simarc-desktop
chmod +x /home/chris/.local/bin/simarc-desktop
echo "BINARY_INSTALLED"

echo "=== 3. Restart preview ==="
PID=$(ss -tlnp 2>/dev/null | grep 4199 | grep -oP 'pid=\K[0-9]+' | head -1)
[ -n "$PID" ] && kill $PID
sleep 3
(npx vite preview --port 4199 --strictPort >/tmp/opencode/preview4.log 2>&1 &)
sleep 6
curl -s -o /dev/null -w "%{http_code}\n" -m 5 http://localhost:4199

echo "=== 4. Test public-search sidebar click ==="
timeout 280 node /tmp/opencode/cdp-click-final.mjs http://localhost:4199/ 34 2>&1 | tail -8

echo "=== 5. Push ke GitHub ==="
git add -A
git -c user.name="chris" -c user.email="chris@bakesbangpol.go.id" \
  commit -q -m "feat: landing page publik cari arsip tanpa login + TiDB Cloud config

- Tambah PublicSearchPage: filter lengkap (status/pemberkasan/klasifikasi/jenis/unit/tanggal/keyword) + table + pagination
- Routing 'public-search' di App.tsx & menu sidebar
- Konfigurasi .env → TiDB Cloud simarc (DB_HOST=gateway01..., DB_DATABASE=simarc)"
git push origin master
echo "PUSH_DONE"
