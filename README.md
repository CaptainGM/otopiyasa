# OtoPiyasa

Türkiye'deki araç ilan sitelerinden fiyat toplayıp analiz eden **full-stack araç fiyat takip platformu** — web + mobil + admin paneli. Üniversite bitirme projesi.

🌐 **Canlı:** https://otopiyasa.app

> Akademik bir projedir; ticari değildir. İlan verileri kaynak sitelerden yalnızca akademik amaçla derlenir, tüm hakları kaynaklarına aittir ve her ilan orijinal kaynağına bağlantı verir. Canlı yayında site giriş yapan kullanıcılara açıktır.

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
- **PWA** (yüklenebilir) · **CI** (GitHub Actions) · **gece zamanlı scrape** (Windows Task Scheduler)
- **Flutter mobil uygulama** — oturum kalıcılığı, favoriler, filtreler, fiyat grafiği

## Veri kaynakları

| Kaynak | Durum |
|--------|-------|
| Arabam.com | ✅ Çalışıyor — ilan detay sayfasından schema.org `Car` ld+json parse edilir |
| Otomerkezi.net | ✅ Çalışıyor — RSC (`__next_f`) payload'ından parse edilir |
| Sahibinden.com | ❌ Cloudflare bot koruması — scrape edilemiyor (bilinen kısıt) |

## Kurulum (yerel geliştirme)

### 1. Backend (Next.js)

```bash
npm install
copy .env.example .env   # .env'i doldur (MONGODB_URI, JWT_SECRET, SMTP*, secret'ler)
npm run dev              # http://localhost:3000
```

Yerelde `NEXT_PUBLIC_REQUIRE_LOGIN` tanımsız bırakılır → site giriş kapısı olmadan açık gelir.
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

- **`scrape.bat`** (kök dizin) — menü: 1) Hızlı güncelleme, 2) Geniş tarama, 3) Otomerkezi tam.
  Gerekirse dev sunucusunu kendi başlatır, `x-scrape-secret` ile `/api/scrape/run`'a POST atar,
  ilerlemeyi (`logs/scrape-progress.txt`) canlı gösterir. Adapter'lar **artımlı kaydeder** (kesilse
  bile o ana kadarki ilanlar DB'ye yazılır).
- **Gece zamanlı scrape** — `scripts/scheduled-scrape.mjs`, Windows Task Scheduler ("OtoPiyasa Gece Scrape", 03:30). Dev sunucusunun açık olmasını gerektirir.

## Test

```bash
npm test          # vitest (parser, rate-limit, regresyon yardımcıları vb.)
npx tsc --noEmit  # tip kontrolü
cd mobile && flutter test && flutter analyze
```

## Deploy

Ayrıntılı runbook: **[DEPLOY.md](DEPLOY.md)**. Özet: MongoDB Atlas → veri migrasyonu → `vercel --prod` → env değişkenleri (`MONGODB_URI`, `JWT_SECRET`, `NEXT_PUBLIC_REQUIRE_LOGIN=1`, `SMTP*`) → Namecheap DNS. Scraper yerelde çalışıp aynı Atlas veritabanına yazar; canlı site o veriyi okur.

## Proje yapısı

```
src/app/          Next.js sayfaları + API route'ları + admin paneli
src/components/    React bileşenleri (kart, grafik, harita, chatbot, formlar…)
src/lib/           İş mantığı (scraper, regresyon, piyasa, mailer, auth, yardımcılar)
src/models/        Mongoose şemaları (Car, User, Comment, Subscription)
mobile/            Flutter uygulaması
scripts/           seed, migrasyon, zamanlı scrape, mail testi
```

## Notlar

- Piyasa ortalaması **sayfadaki tüm ilanların değil**, o aracın marka/model/yıl segmentinin ortalamasıdır.
- Sahibinden Cloudflare nedeniyle scrape edilemez; veri Arabam + Otomerkezi'nden gelir.
- OneDrive `.next` klasörünü ara sıra bozar ("React Client Manifest" 500) → `npm run dev`'i durdur, `.next`'i sil, yeniden başlat.
