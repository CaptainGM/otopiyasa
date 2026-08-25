# OtoPiyasa — otopiyasa.app Yayına Alma Rehberi

Mimari: **otopiyasa.app → Vercel (site) → MongoDB Atlas (veritabanı)** + evdeki PC
(gece scraper'ı, aynı Atlas'a yazar). Toplam veri kullanımı ~30-50 MB.

Kod hazırlıkları tamam: giriş zorunluluğu (`REQUIRE_LOGIN=1`), akademik ibare
footer'ı, Vercel'de Playwright indirmesini atlayan postinstall, taşıma betiği.

## 1. MongoDB Atlas (ücretsiz M0) — ~10 dk
1. https://www.mongodb.com/cloud/atlas → Google hesabıyla kayıt ol.
2. "Create Free Cluster" (M0, AWS Frankfurt önerilir).
3. Database Access → kullanıcı oluştur (kullanıcı adı + güçlü şifre, not al).
4. Network Access → "Allow access from anywhere" (0.0.0.0/0) ekle
   (evdeki scraper'ın IP'si değişken olduğu için gerekli).
5. Connect → Drivers → bağlantı adresini kopyala, sonuna `/otopiyasa` ekle:
   `mongodb+srv://KULLANICI:SIFRE@cluster0.xxxxx.mongodb.net/otopiyasa`

## 2. Veriyi taşı — ~2 dk, birkaç MB
```
node scripts/migrate-to-atlas.mjs "mongodb+srv://...URI..."
```
Tüm koleksiyonlar (araçlar, kullanıcılar, favoriler, abonelikler, yorumlar)
kopyalanır; hesaplar ve şifreler canlıda aynen çalışır.

## 3. Vercel — ~15 dk
Git olmadan, doğrudan CLI ile:
```
npm i -g vercel        (~20 MB, npm üzerinden — bu ağda sorunsuz)
vercel login           (e-posta ile doğrulama)
vercel                 (proje klasöründe; soruları varsayılanla geçebilirsin)
```
Sonra Vercel panelinde (vercel.com → proje → Settings → Environment Variables):

| Değişken | Değer |
|---|---|
| `MONGODB_URI` | Atlas URI'si |
| `JWT_SECRET` | Uzun rastgele bir dize (yerel .env'dekiyle AYNI olursa yerel oturumlar da geçerli olur) |
| `NEXT_PUBLIC_APP_URL` | `https://otopiyasa.app` |
| `REQUIRE_LOGIN` | `1` (siteyi yalnızca giriş yapanlara açar) |
| `SMTP_HOST/PORT/USER/PASS` | Yerel .env'deki değerler (e-postalar canlıdan da gitsin) |

Ardından `vercel --prod` ile canlı dağıtım.

## 4. Domain — ~10 dk (DNS yayılımı +birkaç saat sürebilir)
1. Vercel panel → proje → Settings → Domains → `otopiyasa.app` ekle.
2. Vercel'in gösterdiği DNS kayıtlarını Namecheap → Domain List →
   Manage → Advanced DNS'e gir (genelde bir A kaydı + bir CNAME).
3. Vercel doğrulayınca SSL otomatik gelir (.app zorunlu HTTPS — Vercel halleder).

## 5. Evdeki scraper'ı Atlas'a bağla
Yerel `.env` içindeki `MONGODB_URI`'yi Atlas URI'siyle değiştir → artık
`scrape.bat` / gece görevi doğrudan canlı siteye veri basar.
(İstersen eski yerel URI'yi yorum satırı olarak sakla.)

## Notlar
- Playwright/scraper Vercel'de ÇALIŞMAZ — veri her zaman evdeki PC'den akar.
- `REQUIRE_LOGIN=1` yalnızca canlıda; localhost'ta tanımsız kaldığı için
  geliştirme aynen devam eder.
- Jüriye demo: otopiyasa.app → kayıt ol/giriş → tüm özellikler.
