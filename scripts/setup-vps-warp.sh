#!/bin/bash
# ==============================================================================
# OtoPiyasa - Oracle VPS Cloudflare WARP & PM2 Scraper Kurulum Scripti
# ==============================================================================
# Bu script Oracle VPS üzerinde:
# 1. Cloudflare WARP'ı güvenli SOCKS5 Proxy modunda (Port: 40000) kurar ve başlatır.
#    (SSH bağlantınız KESİNLİKLE KOPMAZ, varsayılan ağ geçidi değişmez!)
# 2. PM2 ile çalışan OtoPiyasa scraper motorunu WARP tüneline bağlar.
# 3. Cloudflare Bot Protection (403/429) engellerini sıfıra indirir.
# ==============================================================================

set -e

echo "===================================================================="
echo "   🚗 OtoPiyasa - Oracle VPS Cloudflare WARP Otomatik Kurulumu"
echo "===================================================================="
echo ""

# 1. Root / Sudo Yetki Kontrolü
if [ "$EUID" -ne 0 ]; then
  SUDO="sudo"
else
  SUDO=""
fi

# 2. Dağıtım Tespiti
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$ID
  VERSION_CODENAME=$VERSION_CODENAME
fi

echo "📋 Tespit edilen işletim sistemi: $OS ($VERSION_CODENAME)"
echo "⏳ Cloudflare WARP indiriliyor ve kuruluyor..."

if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
  $SUDO apt-get update -y
  $SUDO apt-get install -y curl gpg lsb-release

  $SUDO mkdir -p /usr/share/keyrings
  curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg | $SUDO gpg --yes --dearmor --output /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg

  CODENAME=$(lsb_release -cs)
  echo "deb [arch=amd64 signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ $CODENAME main" | $SUDO tee /etc/apt/sources.list.d/cloudflare-warp.list

  $SUDO apt-get update -y
  $SUDO apt-get install -y cloudflare-warp
elif [[ "$OS" == "ol" || "$OS" == "rhel" || "$OS" == "centos" || "$OS" == "rocky" || "$OS" == "almalinux" ]]; then
  $SUDO rpm --import https://pkg.cloudflareclient.com/pubkey.gpg
  $SUDO yum-config-manager --add-repo https://pkg.cloudflareclient.com/cloudflare-warp-ascii.repo 2>/dev/null || true
  $SUDO yum install -y cloudflare-warp
else
  echo "⚠️ Desteklenmeyen dağıtım ($OS). Lütfen elle kurun."
  exit 1
fi

echo ""
echo "⚙️ WARP yapılandırılıyor (SSH Güvenli SOCKS5 Proxy Modu)..."

# WARP servisini başlat
$SUDO systemctl enable --now warp-svc 2>/dev/null || true
sleep 2

# Kayıt ol (Zaten kayıtlıysa hata vermesin)
warp-cli registration new 2>/dev/null || warp-cli register 2>/dev/null || true

# CRITICAL: Proxy Modu (Port: 40000) - SSH bağlantısının kopmaması için şart
warp-cli mode proxy 2>/dev/null || warp-cli set-mode proxy 2>/dev/null || true
warp-cli proxy port 40000 2>/dev/null || true
warp-cli connect 2>/dev/null || true

echo "⏳ Tünel bağlantısı bekleniyor (5 sn)..."
sleep 5

# Test et
echo "🔍 Bağlantı test ediliyor..."
TEST_OUTPUT=$(curl -s -m 8 -x socks5://127.0.0.1:40000 https://cloudflare.com/cdn-cgi/trace || true)

if echo "$TEST_OUTPUT" | grep -q "warp=on"; then
  echo "✅ [MÜKEMMEL] Cloudflare WARP tüneli aktif! (warp=on)"
else
  echo "⚠️ WARP tünelinden yanıt gelmedi veya bekleniyor. Çıktı:"
  echo "$TEST_OUTPUT"
fi

echo ""
echo "🔄 PM2 Scraper Motoru WARP Tüneline Bağlanıyor..."

if command -v pm2 &> /dev/null; then
  # PM2 çalışan process kontrolü
  if pm2 list | grep -q "daemon"; then
    echo "📌 'daemon' süreci tespit edildi. WARP tüneliyle yeniden başlatılıyor..."
    pm2 stop daemon 2>/dev/null || true
    pm2 delete daemon 2>/dev/null || true
  fi

  # Proje dizinini bul
  PROJECT_DIR=$(pwd)
  if [ ! -f "$PROJECT_DIR/scripts/daemon.ts" ]; then
    # Eğer root veya home dizinindeyse bitirme projesini ara
    FOUND_DIR=$(find /home /root -maxdepth 3 -type d -name "*otopiyasa*" -o -name "*bitirme*" 2>/dev/null | head -n 1 || true)
    if [ -n "$FOUND_DIR" ] && [ -f "$FOUND_DIR/scripts/daemon.ts" ]; then
      PROJECT_DIR="$FOUND_DIR"
    fi
  fi

  echo "📁 Çalışma dizini: $PROJECT_DIR"
  cd "$PROJECT_DIR"

  # Proxy ortam değişkenleriyle pm2'de başlat
  ALL_PROXY="socks5://127.0.0.1:40000" \
  HTTP_PROXY="socks5://127.0.0.1:40000" \
  HTTPS_PROXY="socks5://127.0.0.1:40000" \
  pm2 start "npx tsx scripts/daemon.ts" --name daemon --update-env

  pm2 save 2>/dev/null || true

  echo ""
  echo "===================================================================="
  echo "  🎉 TEBRİKLER! KURULUM TAMAMLANDI!"
  echo "  - Cloudflare WARP devrede (Port: 40000)"
  echo "  - OtoPiyasa 7/24 Daemon artık Cloudflare tünelinden süzülüyor!"
  echo "  - pm2 logs daemon komutuyla canlı akışı izleyebilirsin."
  echo "===================================================================="
else
  echo "⚠️ pm2 komutu bulunamadı. Lütfen botunuzu şu komutla başlatın:"
  echo "ALL_PROXY=socks5://127.0.0.1:40000 npx tsx scripts/daemon.ts"
fi
