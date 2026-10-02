# OtoPiyasa

Türkiye'deki ikinci el araç ilan sitelerinden fiyat toplayıp analiz eden bir web sitesi ve mobil uygulama. Üniversite bitirme projesi olarak yapıldı.

Canlı adres: https://otopiyasa.app

Bu proje akademik amaçlıdır, ticari değildir. İlanlar kaynak sitelerden sadece analiz için toplanıyor, her ilan kendi kaynağına bağlantı veriyor ve tüm hakları kaynak sitelere ait.

## Neler var

- İlan listeleme ve filtreleme (marka, model, yıl, fiyat, yakıt, vites, sıralama)
- Piyasa ortalaması: aynı marka, model ve yıldaki araçların ortalama fiyatı
- Fiyat tahmini: veritabanı verisi üzerinde en küçük kareler yöntemiyle (sıfırdan yazılmış) lineer regresyon
- Fiyat geçmişi grafiği ve fırsat araç uyarısı (segmentin ortalamasına göre)
- Araç karşılaştırma, harita (Leaflet), marka bazlı analiz sayfası
- Favoriler ve abonelik: istediğin kritere uyan yeni ilan ya da fiyat düşüşü olunca e-posta gelir
- Kural tabanlı asistan: "en ucuz BMW", "kaç ilan var" gibi sorulara cevap verir
- Yorum ve puanlama, kullanıcı profili, şifre sıfırlama
- Admin paneli (`/admin`): istatistikler, veri çekme paneli, kullanıcı ve araç yönetimi
- Flutter ile yazılmış Android mobil uygulama (`mobile/` klasörü)

## Kullanılan teknolojiler

- Web ve API: Next.js 15, React 19, TypeScript, Tailwind CSS
- Veritabanı: MongoDB (Mongoose), canlıda MongoDB Atlas
- Giriş sistemi: JWT, httpOnly cookie, bcrypt
- Grafik ve harita: Recharts, Leaflet
- Veri çekme: Playwright ve Cheerio
- E-posta: Nodemailer
- Mobil: Flutter
- Yayın: Vercel (web), alan adı Namecheap'ten

## Veri kaynakları

Arabam.com, Otokoç 2. El, Otoplus, VavaCars, Carvak, Otomerkezi, DOD ve İkinciyeni'den ilan çekiliyor. Sahibinden.com Cloudflare koruması yüzünden çekilemiyor.

Arabam.com da Cloudflare kullanıyor, sadece gerçek bir tarayıcıyla ve Türkiye'deki ev internetinden çalışıyor. Bu yüzden bulut sunucuda kapalı, sadece ev bilgisayarında açılabiliyor.

Satılan ilanlar silinmiyor, "Piyasa Arşivi"ne taşınıyor. Bir ilanın satıldığına karar vermeden önce sayfası kontrol ediliyor. Site engellediyse ya da cevap vermediyse ilan arşive atılmıyor.

## Çalıştırma

```
npm install
copy .env.example .env      (içini doldur: MONGODB_URI, JWT_SECRET, SMTP bilgileri)
npm run dev                 (http://localhost:3000)
```

Windows'ta `start.bat` ile de açılıyor. Demo veri için `npm run seed`, gerçek veri için `scrape.bat`.

Mobil uygulama:

```
cd mobile
flutter pub get
flutter run
```

## Veri çekme motoru

`scripts/daemon.ts` 7/24 çalışıyor. Her turda yeni ilanları buluyor, sırası gelen kaynağın bütün ilan listesini baştan sona tarayıp fiyat değişikliklerini güncelliyor ve satılanları arşive alıyor. Sunucuda `pm2 start ecosystem.config.cjs` ile başlatılıyor, güncellemek için `bash scripts/update-server.sh` çalıştırılıyor.

Elle çalıştırmak için `scrape.bat` var (menüden seçiliyor). Ölü ilanları temizlemek için `temizle-olu-ilanlari.bat`.

Sunucu Oracle Linux, SELinux açıkken pm2 servisi sürekli yeniden başlıyordu. `pm2-opc.service` dosyasındaki `PIDFile` satırını silince düzeldi (`sudo sed -i '/^PIDFile=/d' /etc/systemd/system/pm2-opc.service`, sonra `daemon-reload` ve `restart`).

## Test

```
npm test
npx tsc --noEmit
cd mobile && flutter test && flutter analyze
```

## Klasörler

```
src/app/        sayfalar, API route'ları, admin paneli
src/components/ React bileşenleri
src/lib/        scraper, regresyon, piyasa hesabı, mail, giriş sistemi
src/models/     Mongoose şemaları
mobile/         Flutter uygulaması
scripts/        seed, veri çekme motoru, bakım betikleri
```

Daha ayrıntılı anlatım için `dokümantasyon.md` dosyasına bakılabilir.

## Notlar

- Piyasa ortalaması sayfadaki ilanların değil, o aracın marka, model ve yıl grubunun ortalamasıdır
- OneDrive içinde çalışırken `.next` klasörü bozulabiliyor ("React Client Manifest" hatası). `npm run dev`'i durdurup `.next` klasörünü silmek yetiyor
