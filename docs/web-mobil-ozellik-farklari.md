# Web ve mobil özellik farkları

Son kontrol: 13 Ekim 2026. Durum sembolleri: ✔ var · ◐ kısmi · ✖ yok · ? bu turda kontrol edilmedi.

Bu dosya elle tutulur. Yeni bir özellik eklendiğinde ya da bir ekran taşındığında ilgili satırı güncelle.

## Nasıl yeniden kontrol edilir

- Web sayfaları: `find src/app -name page.tsx` (yol: `src/app/**/page.tsx`)
- Mobil ekranlar: `ls mobile/lib/screens`, mobil menü: `mobile/lib/screens/more_screen.dart`
- Mobil API çağrıları: `mobile/lib/services/api_service.dart` (web'deki `/api/*` uç noktalarıyla karşılaştır)

## Ana sayfa ve arama

| Özellik | Web | Mobil | Not |
|---|---|---|---|
| Arama ve filtreler (marka, model, yakıt, vites, satıcı, km, hasarsız, fiyat, sıralama) | ✔ | ✔ | Mobilde filtreler alt sayfada |
| Fırsatlar, en çok bakılanlar, son bakılanlar | ✔ | ✔ | |
| Yakınımdaki ilanlar | ✔ | ✔ | |
| Araç tipi sekmeleri (otomobil, SUV, minivan) | ✔ | ✔ | |
| Harita | ✔ | ✔ | Mobilde ayrı ekran |
| Alt gezinme çubuğu (Keşfet, Favoriler, Değer Kaybı, Karşılaştır, Tahmin, Analiz, Hesap) | ✔ | ✔ | Web'de yalnızca telefon genişliğinde (13 Ekim 2026'da eklendi), masaüstünde üst menü |
| Arama yazım düzeltme (bitişik yazım, harf hatası) | ✔ | ✔ | Sunucuda; mobil de aynı API'yi kullanır |

## İlan detayı

| Özellik | Web | Mobil | Not |
|---|---|---|---|
| Fiyat analizi ve termometre (adil değer) | ✔ | ✔ | |
| Fiyat skalası (yıl, km, hasar, donanım kademeleri) | ✔ | ◐ | Mobilde kod hazır, APK henüz yayımlanmadı |
| Ham ilan ortalaması | ✖ | ✖ | Kaldırıldı; yerine skala kademesi gösteriliyor |
| Piyasa temposu, yakıt maliyeti, fiyat geçmişi | ✔ | ✔ | |
| Benzer ilanlar | ✔ | ✔ | |
| Galeri (kaydırma, tam ekran) | ✔ | ✔ | |
| Hasar ve boya durumu | ✔ | ✔ | |
| İlan soruları | ✔ | ✔ | Mobilde soru sorma akışı ayrıca kontrol edilmeli |
| İlan şikayeti | ✔ | ✔ | |
| Karşılaştırma (en fazla 4 ilan) | ✔ | ✔ | |
| Önizleme sayfası (paylaşım önizlemesi) | ✔ | ✖ | Mobilde gerekmiyor |

## Favoriler ve listeler

| Özellik | Web | Mobil | Not |
|---|---|---|---|
| Birden çok favori listesi, yeni liste oluşturma | ✔ | ✔ | |
| İlanı başka listeye taşıma | ✔ | ✔ | |
| Fiyat bildirimi ve not ekleme | ✔ | ✔ | |

## Teklifler ve ilanlar

| Özellik | Web | Mobil | Not |
|---|---|---|---|
| Teklif verme | ✔ | ✔ | |
| Teklif sohbeti | ✔ | ✔ | |
| İlan verme | ✔ | ✔ | |
| İlanlarım (düzenleme, silme) | ✔ | ✔ | Web'de `/sell/[id]`; mobilde düzenleme ekranı ? |

## Araçlar ve analiz

| Özellik | Web | Mobil | Not |
|---|---|---|---|
| Fiyat tahmini (form) | ✔ | ✔ | |
| Parça seçici: araç şablonu (bölgeden parça adına oklar) | ✔ | ◐ | Mobilde kod ve test hazır, APK henüz yayımlanmadı |
| Fiyat tahmini için fotoğrafla doldurma | ✖ | ✔ | Yalnızca mobilde |
| Değer kaybı | ✔ | ✔ | |
| Piyasa analizi | ✔ | ✔ | |
| Sohbet asistanı (yazıyor balonu dâhil) | ✔ | ✔ | Yanıt metni tek seferde gelir |

## Hesap

| Özellik | Web | Mobil | Not |
|---|---|---|---|
| Kayıt ve giriş | ✔ | ✔ | |
| Şifremi unuttum (kodla sıfırlama) | ✔ | ✔ | |
| E-posta doğrulama ekranı | ✔ | ✖ | Mobilde doğrulama e-postadaki bağlantıyla web'de tamamlanıyor |
| Şifre değiştirme | ✔ | ? | |
| E-posta değiştirme | ✔ | ? | |
| Profil fotoğrafı (avatar) | ✔ | ✔ | |
| Cihaz ve oturum yönetimi | ✔ | ✔ | |
| Abonelikler (kayıtlı arama, fiyat alarmı) | ✔ | ◐ | Mobilde profil içinde, ayrıntılar ? |
| Bildirimler | ✔ | ✔ | |
| Gizlilik politikası | ✔ | ✖ | Mobilde bağlantı yok |
| Veri tasarrufu modu | ✖ | ✔ | Yalnızca mobilde |
| Uygulama güncelleme denetimi | ✖ | ✔ | Yalnızca mobilde. Uygulama içi indirme (ilerleme çubuğu, sistem yükleyicisi) ve sürüm kodu düzeltmesi hazır, APK henüz yayımlanmadı |
| Tema (koyu ve aydınlık) | ✔ | ✔ | |

## Yönetim

| Özellik | Web | Mobil | Not |
|---|---|---|---|
| Genel durum, otonom motor, saatlik özet | ✔ | ✔ | |
| Bekçi (ev bilgisayarı) | ✔ | ✔ | |
| Sağlık | ✔ | ✔ | |
| Kullanıcılar | ✔ | ✔ | |
| Manuel kontrol | ✔ | ✔ | |
| Doğrulanmamış ilanlar | ✔ | ✖ | Web `/admin/unverified` |
| Arşiv | ✔ | ✖ | Web `/admin/archive` |
| Yorum, şikayet, işletme başvurusu onayı | ✔ | ◐ | Mobilde kısmen, ayrıntılar ? |

## Açık işler

- Mobil fiyat skalası kartı: test edildi, APK yayımlanmadı (onay bekleniyor).
- Mobil (13 Ekim 2026, hepsi aynı yayını bekliyor): uygulama içi güncelleme indirmesi, bölünmüş pakette sürüm kodu düzeltmesi (arm64 kodu 2022 görünüyordu, sonraki sürümler hiç sunulmuyordu), parça şablonu, alt pencerelerde sistem gezinme çubuğu boşluğu, kart başlığı iki satır, Keşfet adresi sırası (CDN ısıtıcısıyla eşleşir).
- Mobilde arşiv ve doğrulanmamış ilan ekranları yok (yönetici için, öncelik düşük).
- Gizlilik politikası ve e-posta doğrulama ekranı mobilde yok (web bağlantısıyla çözülebilir).
