# Berat Batuhan Şahin

## OtoPiyasa — Bitirme Projesi Dokümantasyonu

> Türkiye'deki ikinci el araç ilan sitelerinden veri toplayan, analiz eden ve kullanıcılara
> web + mobil üzerinden sunan full-stack bir araç fiyat takip ve alım-satım platformu.

**Canlı adres:** https://otopiyasa.app
**Depo:** GitHub — `CaptainGM/otopiyasa`

---

## 1. Projenin Amacı

OtoPiyasa, ikinci el araç piyasasında **fiyat şeffaflığı** sağlamayı hedefleyen bir üniversite
bitirme projesidir. Türkiye'nin başlıca ilan sitelerinden (Arabam.com, Otomerkezi.net) otomatik
olarak toplanan gerçek ilan verilerini; piyasa ortalaması, istatistiksel fiyat tahmini, anomali
tespiti, harita ve karşılaştırma gibi araçlarla birleştirerek kullanıcıya "bu araç gerçekten bu
fiyata değer mi?" sorusuna veriye dayalı bir cevap sunar.

Proje yalnızca bir "veri gösterme" sitesi değildir — kullanıcılar platform üzerinden **kendi
ilanlarını da verebilir**, alıcı/satıcı **teklif teklif pazarlık edebilir**, **soru sorabilir**,
**şikayet edebilir**; sistem yapay zeka ile ilan içeriğini ve fotoğrafını denetler, sohbet
güvenliğini izler ve fiyat düşüşlerinde kullanıcıyı e-posta/anlık bildirimle uyarır.

Akademik bir projedir, ticari amaç taşımaz. Toplanan ilan verileri yalnızca analiz amaçlı derlenir
ve her ilan orijinal kaynağına bağlantı verir.

---

## 2. Kullanılan Teknolojiler

### 2.1 Web (Next.js Full-Stack)

| Katman | Teknoloji | Amaç |
|---|---|---|
| Dil | TypeScript | Tüm web kod tabanı tip güvenli |
| Framework | Next.js 15 (App Router) | Sayfalar, API route'ları, sunucu bileşenleri tek framework içinde |
| UI kütüphanesi | React 19 | Bileşen tabanlı arayüz |
| Stil | Tailwind CSS v4 | Utility-first CSS, açık/koyu tema |
| Veritabanı | MongoDB + Mongoose | Doküman tabanlı veri modeli (araç, kullanıcı, teklif, vb.) |
| Barındırma (DB) | MongoDB Atlas (M0, ücretsiz katman, Frankfurt) | Canlı veritabanı |
| Kimlik doğrulama | JWT (`jose`) + `bcryptjs` + httpOnly cookie | Oturum yönetimi, şifre hash'leme |
| Grafik | Recharts | Fiyat geçmişi, histogram, trend grafikleri |
| Harita | Leaflet + react-leaflet | İlan konumları, il/ilçe bazlı pinler |
| Web scraping | Playwright + Cheerio | Gerçek ilan verisi toplama |
| E-posta | Nodemailer (SMTP/Gmail) | Doğrulama, şifre sıfırlama, fiyat alarmı e-postaları |
| Tarayıcı bildirimi | `web-push` (VAPID) | Sekme kapalıyken bile tarayıcı bildirimi |
| Mobil bildirim | `firebase-admin` (FCM) | Uygulama tamamen kapalıyken Android bildirimi |
| Yapay zeka | Google Gemini API (`gemini-flash-lite-latest`) | Chatbot, ilan/fotoğraf denetimi, karşılaştırma özeti |
| Test | Vitest | Birim testleri (319 test / 37 dosya) |
| CI/CD | GitHub Actions | Otomatik tip kontrolü + test + zamanlı bulut scrape |
| Deploy | Vercel | Web + API sunucusuz barındırma |
| Domain | Namecheap (GitHub Student Pack) | `otopiyasa.app` |

### 2.2 Mobil (Flutter)

| Katman | Teknoloji | Amaç |
|---|---|---|
| Dil | Dart | Mobil uygulama kodu |
| Framework | Flutter | Tek kod tabanından Android (test edilen platform) |
| Harita | `flutter_map` + OpenStreetMap/Carto | API anahtarı gerektirmeyen harita |
| Grafik | `fl_chart` | Fiyat/analiz grafikleri |
| Bildirim (yerel) | `flutter_local_notifications` | Uygulama açık/arka planda bildirim |
| Bildirim (kapalıyken) | `firebase_core` + `firebase_messaging` | FCM ile tam kapalı uygulama bildirimi |
| Konum | `geolocator` | "Yakınımdakiler" özelliği |
| Fotoğraf | `image_picker` + `image` | İlan fotoğrafı seçme/küçültme |
| Depolama | `shared_preferences` | Oturum, favoriler, karşılaştırma listesi (cihaz içi) |
| Paylaşım | `share_plus` | İlan paylaşma |
| Diğer | `http`, `intl`, `url_launcher` | API istekleri, sayı/tarih biçimleme, dış bağlantı açma |
| Test | `flutter_test` | Model/birim testleri |

### 2.3 Altyapı & Otomasyon

- **Vercel** — web/API canlı barındırma, bölge Atlas ile eşleşecek şekilde `fra1` (Frankfurt).
- **MongoDB Atlas** — tek, paylaşılan bulut veritabanı; hem web hem mobil hem yerel scraper aynı veriyi okur/yazar.
- **GitHub Actions** — (a) her push'ta TypeScript tip kontrolü + Vitest + Flutter analyze/test; (b) günde 2 kez otomatik bulut scrape (PC kapalıyken bile Otomerkezi verisi tazelenir).
- **Windows Task Scheduler** — yerel PC açıkken gece 03:30'da otomatik tam scrape (Arabam dahil).
- **`scrape.bat`** — kullanıcı için tek tıkla scrape menüsü (hızlı/geniş/tam yenileme), ilerlemeyi canlı gösterir, kesintiye dayanıklı (artımlı kayıt).

---

## 3. Mimari Genel Bakış

```
                         ┌─────────────────────────┐
                         │   Arabam.com / Otomerkezi │
                         └────────────┬─────────────┘
                                      │ Playwright + Cheerio (scraper)
                                      ▼
                         ┌─────────────────────────┐
                         │   MongoDB Atlas (bulut)   │  ← tek ortak veri kaynağı
                         └────────────┬─────────────┘
                     ┌────────────────┼────────────────┐
                     ▼                                 ▼
        ┌───────────────────────┐          ┌───────────────────────┐
        │  Next.js (Vercel)      │          │  Flutter mobil uygulama │
        │  - Sayfalar (SSR)      │          │  - REST API tüketir     │
        │  - 50 API route         │◄─────────┤  - Aynı iş mantığını    │
        │  - Admin paneli         │  HTTP    │    ayrı uygular         │
        └───────────┬────────────┘          └───────────┬─────────────┘
                     │                                    │
                     ▼                                    ▼
        Google Gemini API (chatbot,          Firebase Cloud Messaging
        moderasyon, foto analiz)             (kapalıyken bildirim)
```

Web tarafı hem **sunucu** (Next.js API route'ları + sunucu bileşenleri) hem **istemci**
(React) rolünü aynı proje içinde üstlenir; mobil uygulama ise aynı API'yi tüketen bağımsız
bir istemcidir. İki istemci de aynı MongoDB Atlas veritabanını paylaştığı için scraper'ın
topladığı ya da bir kullanıcının verdiği ilan, hem web hem mobilde anında görünür.

---

## 4. Özellikler

### 4.1 İlan keşfi
- Marka, model, yıl, fiyat, yakıt, vites gibi kriterlerle **filtreleme + arama + sayfalama**.
- **Harita** (Leaflet/flutter_map) — il/ilçe bazlı ilan pinleri; ilçe koordinatı bilinmiyorsa il merkezine gruplanır (veri uydurulmaz, dürüst gösterim).
- **Karşılaştırma** — en fazla 4 aracı yan yana tablo halinde kıyaslama + en avantajlı değer vurgusu.
- **Favoriler** ve **kayıtlı aramalar** (yeni ilan/fiyat düşüşü bildirimi).
- **Son bakılanlar** şeridi, **"haftanın fırsatları"** (piyasa ortalamasının belirgin altında olan ilanlar).
- **Yakınımdakiler** — cihaz konumuna göre yarıçap seçilebilir yakın ilan listesi.

### 4.2 Fiyat zekası
- **Piyasa ortalaması** — aracın kendi marka/model/yıl segmentindeki ortalama fiyat.
- **Canlı piyasa ortalaması** — Arabam üzerinden anlık sorgu ile güncel ortalama + "fırsat aracı" etiketi.
- **Fiyat tahmini** — sıfırdan yazılmış OLS (en küçük kareler) lineer regresyon; segment → marka → global fallback zinciri, güven skoru (R²) ve en yakın gerçek karşılaştırılabilir ilanlarla şeffaflık. Formdan **fotoğraf yükleyerek** de tahmin alınabilir (Gemini Vision aracı tanır, formu otomatik doldurur).
- **Fiyat geçmişi grafiği** — bir ilanın zaman içindeki fiyat değişimi.
- **Anomali tespiti** — segment içi z-skoruna göre "istatistiksel fırsat" / "piyasa üstü fiyat" uyarısı.
- **Fiyat histogramı** — bir aracın, kendi segmentindeki fiyat dağılımında nereye düştüğünü gösterir; çubuklar tıklanabilir (o aralığa filtreler).

### 4.3 Yapay zeka (Google Gemini)
- **Sohbet asistanı** — kullanıcının doğal dildeki mesajını niyet sınıflandırmasıyla (arama/filtre/en ucuz/en pahalı/sayım/ortalama/yönlendirme/genel soru) anlar, gerçek veritabanı sorgusuyla yanıtlar (Gemini asla sayı/fiyat uydurmaz — yalnızca niyeti anlar, veriyi sistem çeker). Konu dışı isteklere (ödev, kod, genel kültür) kibarca sınır koyar.
- **İlan içerik denetimi** — yeni/düzenlenen ilan; önce fiyat tabanı kontrolünden, sonra (varsa fotoğraf) yapay zeka görsel marka doğrulamasından, sonra metin içerik denetiminden geçer. Uygunsuz/şüpheli/marka uyuşmayan ilanlar otomatik reddedilir.
- **Fotoğraftan araç tanıma** — marka/model/yıl tahmini + hasar/boya durumu tespiti (fiyat tahmini formunda ve ilan denetiminde kullanılır).
- **Karşılaştırma AI özeti** — karşılaştırılan araçlar için hangisinin neden daha mantıklı olduğunu somut verilerle (km, yıl, hasar, fiyat) açıklayan doğal dil özeti.

### 4.4 İlan verme & satıcı araçları
- Kendi ilanını verme: marka/model/yıl, fiyat, km, il/ilçe, açıklama, çoklu fotoğraf yükleme (tarayıcıda/mobilde küçültülüp gönderilir), minimum teklif tutarı.
- **İlan yaşam döngüsü** — satıcı ilanını silmeden "satıldı" işaretleyebilir; kaynak sitede ilan kaldırılırsa (410/404) sistem otomatik "kaldırıldı" işaretler.
- **Görüntülenme sayacı** ve **favori sayısı**.
- **Paylaş butonu** (WhatsApp / link kopyala / native share).
- **İşletme hesabı** — galeri/bayi kullanıcılar işletme hesabına başvurabilir; admin onaylar/reddeder.

### 4.5 Teklif / pazarlık sistemi
- Alıcı ilana teklif verir (ilan fiyatını geçemez, satıcının belirlediği alt sınırın altında olamaz).
- Satıcı kabul/reddeder; kabul edilirse **48 saatlik mesajlaşma penceresi** açılır ve taraflar satıcının telefon numarasını görebilir.
- **Sohbet güvenliği** — platform dışına yönlendirme (WhatsApp/Telegram vb.) veya kapora/ön ödeme isteyen mesajlar otomatik tespit edilip uyarı gösterilir; tekrar eden ihlallerde kullanıcı kademeli olarak (30 güne kadar) sohbetten men edilir.

### 4.6 Soru-cevap ve şikayet
- İlan sayfasında herkese açık **soru-cevap** bölümü (yalnızca üye ilanlarında; derlenen ilanlarda anlamsız olduğu için gösterilmez).
- **İlan şikayeti** — satıldı/yanlış bilgi/dolandırıcılık/uygunsuz/diğer sebepleriyle bildirme; admin panelinde inceleme kuyruğu.

### 4.7 Kullanıcı hesabı
- Kayıt, giriş, **e-posta doğrulama**, şifre sıfırlama (e-posta ile), şifre değiştirme.
- **İki aşamalı e-posta değiştirme** — önce mevcut e-postaya kod (hesap sahipliği kanıtı), sonra yeni e-postaya kod (adresin gerçekten erişilebilir olduğunu doğrulama).
- Profil sayfası: hesap bilgileri, favoriler, kayıtlı aramalar, bildirim tercihleri.

### 4.8 Bildirimler
- **E-posta** — favori ilanda fiyat düşüşü, kayıtlı arama kriterine uyan yeni ilan, teklif geldi/yanıtlandı, şifre sıfırlama, e-posta doğrulama.
- **Tarayıcı web push** (VAPID) — sekme/tarayıcı kapalıyken de bildirim (masaüstü Chrome/Edge/Firefox, Android Chrome).
- **Mobil FCM** — Android uygulaması tamamen kapalıyken bile bildirim (bkz. Bölüm 6).
- Uygulama içi **bildirim çanı** + 60 saniyelik yoklama ile anlık okunmamış sayacı.

### 4.9 Admin paneli
- İstatistik kartları (ilan/kullanıcı/abonelik/yorum sayıları).
- Scrape kontrol paneli + gece scrape log görüntüleyici.
- Kullanıcı ve ilan yönetim tabloları (silme, moderasyon).
- İşletme hesabı başvuru onay/red kuyruğu.
- Şikayet inceleme kuyruğu.

### 4.10 Analiz sayfası
- Markaya göre ortalama fiyat (top-12 marka, model bazlı kırılım).
- Model yılına göre ortalama fiyat eğrisi (segment bazlı, brand-level ortalamanın yanıltıcılığını önlemek için model bazlı hesaplanır).
- Marka trend grafiği (yeterli zaman verisi biriktiğinde otomatik devreye girer).

### 4.11 Diğer
- **Açık/koyu tema** (sistem tercihine duyarlı, `localStorage` ile kalıcı).
- **PWA** — yüklenebilir web uygulaması.
- **Hasar/boya diyagramı** — araç silueti üzerinde, hangi parçanın (tampon, kaput, çamurluk vb.) hasarlı/boyalı olduğunu gerçek konumuna yakın bir okla gösterir.
- **Yorum & puanlama** — otomatik duygu (sentiment) etiketi.

### 4.12 Mobil uygulama (Flutter)
Web ile büyük ölçüde özellik paritesine sahiptir: ilan listeleme/filtreleme/arama, favoriler,
harita (filtrelenebilir), karşılaştırma (+ AI özeti), analiz grafikleri, fiyat tahmini
(fotoğraftan dahil), ilan verme/düzenleme/durum yönetimi, teklif/soru-cevap, şikayet, hasar
diyagramı, fiyat histogramı, canlı piyasa rozeti, işletme hesabı başvurusu, e-posta değiştirme,
profil, oturum kalıcılığı, açık/koyu tema, anasayfa şeritleri (fırsatlar/son bakılanlar/trend).

---

## 5. Veri Kaynakları ve Scraping

| Kaynak | Durum | Yöntem |
|---|---|---|
| **Arabam.com** | ✅ Çalışıyor | İlan detay sayfasındaki schema.org `Car` ld+json + spec listesi parse edilir. Yalnızca ev/açık ağdan erişilebilir. |
| **Otomerkezi.net** | ✅ Çalışıyor | Sayfa 1 ld+json, sonraki sayfalar Next.js RSC (`__next_f`) payload'ından parse edilir. Cloudflare koruması yok, bulut ortamından da çalışır. |
| **Sahibinden.com** | ❌ Engelli | Cloudflare bot koruması nedeniyle headless tarayıcıyla dahi taranamıyor — bilinen ve kabul edilmiş bir kısıt. |

Scraper'lar **artımlı kaydeder**: bir tarama yarıda kesilse bile o ana kadar işlenen ilanlar
veritabanına yazılmış olur, kaldığı yerden devam edilebilir. Fiyat/hasar bilgisi zamanla
değiştiği için ayrı bir **"fiyat yenileme" modu** en bayat (en eski güncellenen) ilanları
periyodik olarak yeniden ziyaret eder.

**Bulut scraping gerçeği:** GitHub Actions üzerinden (PC kapalıyken) çalıştırılan otomatik
tarama yalnızca Otomerkezi'ni tazeleyebilir — Arabam'ın Cloudflare koruması GitHub/Azure veri
merkezi IP'lerini engelliyor. Arabam taraması bu yüzden yalnızca ev/açık ağdan (yerel PC,
`scrape.bat`) çalıştırılabiliyor.

---

## 6. Bildirim Mimarisi (Web Push + FCM)

Proje **üç katmanlı** bir bildirim stratejisi kullanır:

1. **E-posta** (Nodemailer/SMTP) — her zaman çalışır, hesap gerektirmez.
2. **Tarayıcı web push** (VAPID standardı, `web-push` kütüphanesi) — kullanıcı tarayıcıdan izin verirse, sekme/tarayıcı kapalıyken de masaüstünde bildirim düşer.
3. **Firebase Cloud Messaging (FCM)** — Android mobil uygulaması **tamamen kapatılmış** olsa bile bildirim ulaştırmanın tek yolu; web push standardı mobil işletim sistemi seviyesinde bu senaryoyu kapsamaz.

Sunucu tarafında `sendPushToUsers()` bu iki kanalı (web push + FCM) paralel olarak tetikler;
biri yapılandırılmamışsa sessizce atlanır, diğeri çalışmaya devam eder. Mobil tarafta
`PushService`, native Firebase kurulumu yoksa hatasız şekilde devre dışı kalacak biçimde
yazılmıştır (yoklama tabanlı bildirim her koşulda çalışır).

---

## 7. Güvenlik

- **Kimlik doğrulama**: JWT (httpOnly cookie) + bcrypt şifre hash'leme.
- **Sayfa erişim kontrolü**: `requirePageAuth()` sunucu bileşenlerinde gerçek JWT doğrulaması yapar (yalnızca middleware'e güvenilmez — sahte cookie ile içerik sayfalarına erişim engellenir).
- **Rate limiting**: giriş, kayıt, şifre sıfırlama, fiyat tahmini gibi hassas uçlarda IP+bucket bazlı sınırlama.
- **ReDoS koruması**: kullanıcı girdisi arama sorgularında (`$regex`) `escapeRegExp` ile kaçışlanır.
- **İçerik moderasyonu**: yapay zeka destekli ilan/fotoğraf denetimi + kural tabanlı fiyat tabanı kontrolü.
- **Sohbet güvenliği**: platform dışı yönlendirme/kapora tespiti, kademeli otomatik susturma.
- **E-posta doğrulama** zorunlu; geçici/tek kullanımlık e-posta adresleri reddedilir.

---

## 8. Test & Kalite

- **319 birim testi / 37 test dosyası** (Vitest) — scraper parser'ları, regresyon/istatistik yardımcıları, fiyat/tarih ayrıştırma, güvenlik yardımcıları, chatbot niyet ayrıştırma vb.
- **Flutter test** — model/birim testleri, `flutter analyze` ile statik analiz.
- **TypeScript** — `tsc --noEmit` ile tüm proje tip güvenliği.
- **CI (GitHub Actions)** — her push'ta web (tip kontrolü + test) ve mobil (analyze + test) otomatik doğrulanır.

---

## 9. Proje Ölçeği (kod tabanı özeti)

| Metrik | Sayı |
|---|---|
| Next.js sayfası | 21 |
| API route'u | 50 |
| React bileşeni | 70 |
| `src/lib` iş mantığı modülü | 67 |
| Mongoose veri modeli | 11 |
| Birim testi | 319 (37 dosya) |
| Flutter dosyası | 36 (16 ekran) |

---

## 10. Deploy & Altyapı Özeti

- **Web/API**: Vercel, `fra1` (Frankfurt) bölgesi — MongoDB Atlas ile aynı bölge (gecikmeyi azaltmak için).
- **Veritabanı**: MongoDB Atlas M0 (ücretsiz katman, 512MB), Frankfurt.
- **Domain**: `otopiyasa.app` (Namecheap, GitHub Student Pack üzerinden alındı).
- **Kaynak kontrol**: GitHub deposu (public), CI etkin.
- **Yerel geliştirme**: `start.bat` ile tek tıkla sunucu, `scrape.bat` ile tek tıkla veri toplama.

---

## 11. Bilinçli Kapsam Dışı Bırakılanlar / Bilinen Kısıtlar

Aşağıdakiler eksiklik değil, proje kapsamı ve zaman/kaynak kısıtları dahilinde **bilinçli
kararlardır**:

- **Sahibinden.com scrape edilemiyor** — Cloudflare bot koruması; sektörde bilinen bir kısıt, README'de açıkça belirtiliyor.
- **Ödeme/işlem altyapısı yok** — platform yalnızca ilan + iletişim/teklif aracılığı yapar, gerçek para transferi/sözleşme platform üzerinden gerçekleşmez (gerçek pazar yerlerinde olduğu gibi tarafları buluşturur, işlemi üstlenmez).
- **Gerçek zamanlı (WebSocket) sohbet yok** — teklif mesajlaşması 60 saniyelik yoklama ile çalışır, anlık değildir.
- **iOS sürümü test edilmedi** — Flutter kod tabanı platformdan bağımsızdır ama geliştirme/derleme yalnızca Android üzerinde yapıldı ve doğrulandı.
- **Detaylı harita hassasiyeti sınırlı** — ilçe düzeyinde koordinat yalnızca İstanbul ve İzmir için elle girildi; diğer illerde il merkezine gruplanır (uydurma dağıtım yapılmaz, dürüst gösterim tercih edildi).
- **Üst hız/0-100/güvenlik donanımı kataloğu boş** — veri alanları modelde hazır ama güvenilir/ücretsiz bir Türkiye-pazarı veri kaynağı bulunamadığı için doldurulmadı.
- **Bulut ortamından tam otomatik scraping mümkün değil** — Arabam'ın Cloudflare koruması nedeniyle Arabam taraması yalnızca ev/açık ağdan tetiklenebiliyor (bkz. Bölüm 5).
- **Tek, ücretsiz katman veritabanı** — MongoDB Atlas M0 (512MB); büyük ölçekte yükseltme gerekecek bir mimari sınır olarak biliniyor.
- **Mobil kapalıyken bildirim (FCM)** — kod tarafı hazır; canlıda Firebase servis hesabı anahtarının Vercel ortam değişkenlerine eklenmesi gerekiyor.

---

## 12. Kullanıcı Rolleri

| Rol | Yetkiler |
|---|---|
| **Ziyaretçi** | Giriş gerektiren sayfalar dışındakileri görüntüleyebilir (canlıda site giriş kapılı) |
| **Üye (bireysel)** | İlan verme, teklif/soru, favori, abonelik, profil |
| **İşletme hesabı** | Bireysel yetkiler + onaylı işletme rozeti (admin onayı gerekir) |
| **Admin** | Tüm yönetim paneli: kullanıcı/ilan yönetimi, scrape kontrolü, işletme/şikayet onayı |

---

*Son güncelleme: Ağustos 2026*
