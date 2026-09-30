#!/usr/bin/env bash
# Sunucuda (Oracle VPS) 7/24 motoru GitHub'daki son koda günceller.
#
#   cd ~/otopiyasa && bash scripts/update-server.sh
#
# `.env` ve logs/ takip edilmediği için korunur. Sunucuda elle değiştirilmiş takip edilen
# dosya varsa `reset --hard` onları siler; bu yüzden önce listelenir.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Yerel değişiklikler (varsa bunlar silinecek):"
git status --short || true

echo "→ Kod çekiliyor..."
git fetch origin main
git reset --hard origin/main
git log --oneline -1

echo "→ Bağımlılıklar..."
npm install --no-audit --no-fund

echo "→ Motor yeniden başlatılıyor..."
if pm2 describe daemon >/dev/null 2>&1; then
  pm2 restart daemon --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

sleep 8
echo "→ Son loglar:"
pm2 logs daemon --lines 40 --nostream
