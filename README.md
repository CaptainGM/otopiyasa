# OtoPiyasa

Türkiye'deki araç ilan sitelerinden fiyat toplayıp analiz eden **full-stack araç fiyat takip platformu** — web + mobil + admin paneli. Üniversite bitirme projesi.

🌐 **Canlı:** https://otopiyasa.app

> Akademik bir projedir; ticari değildir. İlan verileri kaynak sitelerden yalnızca akademik amaçla derlenir, tüm hakları kaynaklarına aittir ve her ilan orijinal kaynağına bağlantı verir. Araç kataloğu herkese açıktır; ilan verme, teklifler ve profil işlemleri giriş gerektirir.

## Mimari

| Katman | Teknoloji |
|--------|-----------|
| Web + API + Admin | Next.js 15 (App Router) · React 19 · TypeScript |
| Stil | Tailwind CSS v4 |
| Veritabanı | MongoDB (Mongoose) — canlıda MongoDB Atlas |
| Kimlik doğrulama | JWT (jose) · httpOnly cookie · bcrypt · rate limiting |
| Grafik / Harita | Recharts · Leaflet |
| Mobil uygulama | Flutter (`mobile/`) |
| Scraper | Playwright + Cheerio (Arabam.com, Otomerkezi.net) |
| E-posta | Nodemailer (fiyat/abonelik alarmları, şifre sıfırlama) |
| Deploy | Vercel (web) + Atlas (DB) + otopiyasa.app (Namecheap) |

## Özellikler

- **İlan listeleme & filtreleme** — marka, model, yıl, fiyat, yakıt, vites, sıralama, sayfalama
- **Piyasa ortalaması** — her araç için aynı marka/model/yıl segmentinin ortalaması
- **Fiyat tahmini** — veritabanı üzerinde sıfırdan yazılmış OLS (en küçük kareler) lineer regresyon; segment → marka → global fallback zinciri, R² skoru
- **Canlı piyasa ortalaması** — Arabam üzerinden anlık ortalama + "fırsat aracı" etiketi
- **Fiyat geçmişi grafiği** ve **anomali tespiti** (segment içi z-skoru ile istatistiksel fırsat / piyasa üstü uyarısı)
- **Araç karşılaştırma** — yan yana tablo, "en iyi değer" vurgusu
- **Harita** (Leaflet) — şehir bazlı gruplu ilan pinleri
- **Analiz sayfası** — markaya göre ortalama fiyat, model yılı fiyat eğrileri
- **Favoriler** ve **abonelikler** (kriterlere uyan yeni ilan/fiyat düşüşü geldiğinde e-posta)
- **Kural tabanlı asistan (chatbot)** — SSS + "en ucuz BMW", "kaç ilan var" gibi veri sorguları
- **Yorum & puanlama** — otomatik duygu (sentiment) etiketi
- **Kullanıcı profili**, şifre değiştirme, şifre sıfırlama (e-posta)
- **Admin paneli** (`/admin`) — istatistikler, scrape paneli, gece scrape log'u, kullanıcı/araç yönetimi
- **PWA** (yüklenebilir) · **7/24 otonom veri motoru** (keşif + tam envanter senkronu + arşivleme)
- **Flutter mobil uygulama** — oturum kalıcılığı, favoriler, filtreler, fiyat grafiği

## Veri kaynakları

| Kaynak | Yöntem | Doğrulama (satıldı mı?) |
|--------|--------|--------------------------|
| Arabam.com | İlan detayında schema.org `Car` ld+json. Cloudflare nedeniyle gerçek Chromium ve **Türkiye ev IP'si** gerekir | Sitemap + detay sayfası (`scrape.bat` 11) |
| Otokoç 2. El | Liste sayfası kartları (`data-*` öznitelikleri) | Tam envanter senkronu + ilan sayfası (soft 404: ilan verisi yoksa satılmış) |
| Otoplus | Liste sayfası schema.org ld+json | Tam envanter senkronu + ilan sayfası (satılınca model kataloğuna yönlenir) |
| VavaCars | Kendi arama API'si | Tam envanter senkronu |
| Carvak | Angular sunucu durumu (`serverApp-state`) | Tam envanter senkronu |
| Otomerkezi | Next.js RSC yükü | Tam envanter senkronu |
| DOD | Sitemap + ilan sayfası ld+json | Sitemap = envanter |
| İkinciyeni | Açık ihale API'si | Tam envanter senkronu |

Sahibinden.com Cloudflare nedeniyle taranamıyor (bilinen kısıt).

## Kurulum (yerel geliştirme)

### 1. Backend (Next.js)

```bash
npm install
copy .env.example .env   # .env'i doldur (MONGODB_URI, JWT_SECRET, SMTP*, secret'ler)
npm run dev              # http://localhost:3000
```

Yerelde araç kataloğu herkese açıktır; ilan verme, teklifler, favoriler ve profil gibi
hesaba bağlı işlemler için giriş yapılması gerekir.
Windows'ta hızlı başlatma için kök dizindeki **`start.bat`** kullanılabilir.

### 2. Veri

```bash
npm run seed                              # demo veri
# veya gerçek kaynaklar (admin girişi ya da x-scrape-secret ile):
# scrape.bat → 1) Hızlı güncelleme (Arabam 30 + Otomerkezi 60)
```

### 3. Flutter mobil

```bash
cd mobile
flutter pub get
flutter run -d windows        # veya Android emülatör (API otomatik 10.0.2.2:3000)
```

## Scraping

### 7/24 otonom motor (`scripts/daemon.ts`)

Her tur (varsayılan 5 dk aralık):

1. **Keşif** — kurumsal kaynakların ilk sayfalarından yeni ilanlar.
2. **Tam envanter senkronu** — sırası gelen *tek* kaynağın tüm ilan listesi baştan sona taranır
   (`src/lib/scraper/reconcile.ts`): fiyat/km/foto değişiklikleri işlenir, satılanlar **Piyasa Arşivi**'ne
   taşınır, arşivdeyken sitede yeniden görünenler geri açılır. Aralıklar: VavaCars 6 sa, Otokoç ve DOD 24 sa, diğerleri 12 sa.
3. **Arabam sitemap** (günde 1) — Arabam'ın açık sitemap dosyalarından öncelik işaretleri (`arabam-sitemap.ts`).
4. **Arabam** — yalnızca `EXCLUDE_ARABAM=false` iken (Türkiye ev IP'si olan makinede): yeni ilanlar sitemap'ten bulunan aday kuyruğundan (`arabam-discovery.ts`), mevcutların fiyat/durum kontrolü detay sayfasından yapılır.

**Arşiv kuralları** (`src/lib/scraper/listing-lifecycle.ts`): kesin kanıt (ilan sayfası 404, ilan numarası kaybolan
yönlendirme, soft 404) tek gözlemle arşivler; "tam envanterde görünmedi" gibi zayıf kanıt en az iki gözlem ve 6 saat ister.
Engel, zaman aşımı ve anlaşılamayan yanıt **asla** ilanı arşivlemez. Bir partide ölü oranı anormalse (%35+) ya da envanter
taraması eksik/şüpheliyse (yarıda kesildi, aktiflerin %50'sinden fazlası kayıp) **hiçbir şey arşivlenmez** (devre kesici).
`lastVerifiedAt` ilanın kaynakta son teyit edildiği anı, `updatedAt` içeriğin son değişimini tutar.

### Çalıştırma

- **Sunucuda (pm2):** `pm2 start ecosystem.config.cjs`. Yeni kod için sunucuda `bash scripts/update-server.sh`
  (`git fetch` + `reset --hard origin/main` + `npm install` + `pm2 restart daemon`). Eskiden geçmiş yeniden yazıldığı
  için `git pull` çalışmıyordu; daemon artık kendi kendini `fetch + reset --hard` ile de güncelliyor.
- **Sunucu notu (SELinux):** Oracle Linux'ta SELinux açıkken systemd `pm2-<kullanıcı>.service` içindeki `PIDFile`'ı okuyamaz;
  servis sürekli "başarısız" sayılıp yeniden başlatılır ve motor her ~90 saniyede bir öldürülür. Çözüm:
  `sudo sed -i '/^PIDFile=/d' /etc/systemd/system/pm2-opc.service && sudo systemctl daemon-reload && sudo systemctl restart pm2-opc`.
  Kullanılmayan `pm2-root.service` kapatılmalıdır (`sudo systemctl disable --now pm2-root`). Kontrol: `pm2 list` çalışma süresi dakikalarca artmalı.
- **Elle:** `scrape.bat` — `11` Arabam doğrula, `N` Arabam yeni ilanlar (sitemap), `S` Arabam sitemap, `E` kurumsal envanter senkronu, `G` galeri/detay tamamlama, `T` turbo çekim.
  `temizle-olu-ilanlari.bat` → `6` kurumsal envanter senkronu.
- `npm run daemon`, `npm run reconcile [kaynak]`, `npm run arabam-sitemap`.

### Arabam ve Cloudflare

Arabam ilan detay ve liste sayfaları Cloudflare doğrulaması gösteriyor; düz `curl`/Node isteği Türkiye ev IP'sinden bile
403 alıyor (TLS parmak izi). Gerçek Chromium ev IP'sinde geçiyor, veri merkezi ve yurtdışı IP'lerinde geçmiyor. Bu yüzden
Arabam bulut sunucuda kapalıdır. Sitemap dosyaları (`/sitemap/advert_N.xml`, ~1,3 milyon ilan) ise doğrulamasız erişilebilir.
Sitemap'te olmamak tek başına ilanı öldürmez (ölçümde eksik olabildiği görüldü); yalnızca detay taramasında öne alır.

## Test

```bash
npm test          # vitest (parser, rate-limit, regresyon yardımcıları vb.)
npx tsc --noEmit  # tip kontrolü
cd mobile && flutter test && flutter analyze
```

## Deploy

Özet: MongoDB Atlas → veri migrasyonu → `vercel --prod` → env değişkenleri (`MONGODB_URI`, `JWT_SECRET`, `SMTP*`) → Namecheap DNS. Scraper yerelde çalışıp aynı Atlas veritabanına yazar; canlı site o veriyi okur.

## Proje yapısı

```
src/app/          Next.js sayfaları + API route'ları + admin paneli
src/components/    React bileşenleri (kart, grafik, harita, chatbot, formlar…)
src/lib/           İş mantığı (scraper + ilan yaşam döngüsü, regresyon, piyasa, mailer, auth, yardımcılar)
src/models/        Mongoose şemaları (Car, User, Offer, SourceSyncState, ScrapeMetric …)
mobile/            Flutter uygulaması
scripts/           seed, migrasyon, zamanlı scrape, mail testi
```

## Notlar

- Piyasa ortalaması **sayfadaki tüm ilanların değil**, o aracın marka/model/yıl segmentinin ortalamasıdır.
- OneDrive `.next` klasörünü ara sıra bozar ("React Client Manifest" 500) → `npm run dev`'i durdur, `.next`'i sil, yeniden başlat.
