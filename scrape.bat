@echo off
title OtoPiyasa - Veri Cekme
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [HATA] Node.js bulunamadi. Once Node.js kurulu oldugundan emin ol.
    pause
    exit /b 1
)

echo ====================================================================
echo               OTOPIYASA - GELISMIS VERI CEKME MERKEZI
echo ====================================================================
echo  [★] EN HIZLI SERI CEKIM (30.000 - 40.000 Canli Ilan Hedefi)
echo   ------------------------------------------------------------------
echo    T  - TURBO SERI CEKIM   (Dakikada ~1.000 ilan! Sayfa basina 20 arac direkt iceri!)
echo    2  - TURBO Arabam Cekim (Kategoriler + 40 Marka + Tum Siralamalar)
echo.
echo  [A] COKLU KAYNAK TARAMALARI (8 Kurumsal Platform)
echo   ------------------------------------------------------------------
echo    1  - Hizli Cekim        (8 Kaynak, toplam ~200 taze ilan, ~3 dk)
echo    12 - TAM 8 KAYNAK CEKIM (8 Kaynaktan binlerce ilan, en genis havuz!)
echo.
echo  [B] FIYAT TAHMIN ^& AI MODELINI GUCLENDIRME (Model Dogrulugu Icin)
echo   ------------------------------------------------------------------
echo    6  - Nadir MODEL        (^<10 ilanli modelleri Arabam'da arar, AI R2 artar)
echo    7  - Nadir MODEL genis  (^<15 ilanli 300 modeli Arabam'da derin tarar)
echo    4  - Nadir MARKA        (^<40 ilanli markalari Arabam'da tarar: Alfa, Jeep vb.)
echo    5  - En Az Markalar     (^<15 ilanli nadir markalari Arabam'da 20 sayfa tarar)
echo.
echo  [C] TEKIL KURUMSAL KAYNAKLAR (8 Kurumsal Envanter)
echo   ------------------------------------------------------------------
echo    17 - Yalnizca Otokoc    (Koc Grubu en buyuk 2. el agi ~2500 ilan)
echo    18 - Yalnizca DOD       (Dogus Otomotiv ekspertizli ~1500 ilan)
echo    19 - Yalnizca Ikinciyeni(Anadolu Grubu / Celik Motor ~1000 ilan)
echo    13 - Yalnizca VavaCars  (Tam ekspertizli envanter ~500 ilan)
echo    15 - Yalnizca Otoplus   (Sahibinden garantili envanter ~500 ilan)
echo    3  - Yalnizca Otomerkezi(Tam kurumsal envanter ~250 ilan)
echo    16 - Yalnizca Carvak    (Uluslararasi ekspertizli envanter ~300 ilan)
echo.
echo  [D] VERITABANI BAKIM ^& SENKRONIZASYON (Mevcut Ilanlari Guncelleme)
echo   ------------------------------------------------------------------
echo    11 - Arabam Dogrula     (Tum Arabam ilanlari: fiyat esitle, satilani arsivle,
echo                             yanlislikla arsivlenenleri geri al; once sitemap)
echo    8  - Fiyat Taramasi     (En uzun suredir dogrulanmayan 800 Arabam ilani)
echo    9  - Adres Tamamlama    (Ilcesi eksik ilanlarin adresini doldur - Harita)
echo    S  - Arabam Sitemap     (32 sitemap dosyasi, ~2 dk; dogrulama onceligi icin)
echo    E  - Kurumsal Envanter  (Otokoc, DOD, VavaCars... tum envanteri senkronla)
echo.
echo    G  - GALERI ^& ACIKLAMA  (Arabam + Otokoc + Otoplus: tum fotograf, aciklama, tramer/boya)
echo    P  - PARALEL MOD        (Iki modu ayni anda calistir, ornegin 11 + 12)
echo ====================================================================
echo.
set /p secim="Secimin (T, G, S, E, 1-19 veya P, varsayilan T): "
if "%secim%"=="" set secim=T

if /i "%secim%"=="T" goto :turbo
if "%secim%"=="2" goto :turbo
if /i "%secim%"=="G" goto :galeri
if "%secim%"=="11" goto :mod11
if "%secim%"=="8" goto :mod8
rem 10 ve 14 eski "tam yenileme / stealth" modlariydi; artik ayni isi 11 yapiyor.
if "%secim%"=="10" goto :mod11
if "%secim%"=="14" goto :mod11
if /i "%secim%"=="S" goto :sitemap
if /i "%secim%"=="E" goto :envanter

echo.
echo Sunucu kontrol ediliyor...
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 5 -UseBasicParsing | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
    echo Sunucu kapali. start.bat ile ayri pencerede baslatiliyor...
    start "OtoPiyasa Sunucu" cmd /k "%~dp0start.bat"
    echo Sunucunun hazir olmasi bekleniyor ^(bu birkac dakika surebilir^)...
    powershell -NoProfile -Command "$ok=$false; for($i=0; $i -lt 120; $i++){ try{ Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 3 -UseBasicParsing | Out-Null; $ok=$true; break } catch { Start-Sleep -Seconds 2 } }; if($ok){ Write-Host 'Sunucu hazir.' } else { exit 1 }"
    if errorlevel 1 (
        echo.
        echo [HATA] Sunucu 4 dakikada hazir olmadi.
        echo Acilan "OtoPiyasa Sunucu" penceresini kontrol et; hazir olunca
        echo bu scrape.bat'i tekrar calistir ^(sunucu acikken hemen taramaya gecer^).
        pause
        exit /b 1
    )
) else (
    echo Sunucu zaten calisiyor.
)

if /i "%secim%"=="P" goto :paralel

echo.
node scripts\scrape.mjs %secim%

echo.
echo Not: veri cekme bitti. Sunucu ayri pencerede acik kaldi;
echo siteyi kullanmaya devam edebilir ya da o pencereyi kapatabilirsin.
pause
goto :eof

:paralel
echo.
echo === PARALEL MOD ===
echo Iki modu ayni anda, ayri pencerelerde calistirir.
echo Ornek: 11 ve 12 yazarak dogrulama + yeni ilan toplamayı birlikte baslatabilirsin.
echo.
set /p mod1="Birinci mod numarasi (ornegin 11): "
set /p mod2="Ikinci mod numarasi  (ornegin 12): "
echo.
echo Baslatiliyor: Mod %mod1% ve Mod %mod2% ayri pencerelerde...
start "OtoPiyasa Mod %mod1%" cmd /k "cd /d "%~dp0" && node scripts\scrape.mjs %mod1% && pause"
start "OtoPiyasa Mod %mod2%" cmd /k "cd /d "%~dp0" && node scripts\scrape.mjs %mod2% && pause"
echo.
echo Her iki tarama ayri pencerelerde baslatildi.
echo Pencerelerini kapatarak istedigin zaman durdurabilirsin.
pause
goto :eof

:turbo
echo.
echo ====================================================================
echo   TURBO SERI VERI CEKIM MODU (Dakikada ~1.000 Ilan)
echo   Hedeflenen taze ilan sayisina ulasana kadar tum kategorileri,
echo   40 farkli markayi ve siralama filtrelerini kesintisiz tarar.
echo ====================================================================
echo.
set /p hedef="Hedef yeni ilan adedi (Varsayilan 25000, direk baslatmak icin Enter): "
if "%hedef%"=="" set hedef=25000
echo.
echo [BASLATILIYOR] %hedef% taze ilan icin Turbo Motor devreye giriyor...
echo.
npx tsx scripts\turbo-arabam.ts %hedef%
echo.
pause
goto :eof

:galeri
echo.
echo ====================================================================
echo   TAM DETAY, GALERI ^& HASAR TAMAMLAMA MOTORU
echo   1) Kurumsal kaynaklar (Otokoc, Otoplus): ilan sayfasindan tum fotograflar,
echo      tramer, boya/degisen, renk, kasa tipi ve motor hacmi.
echo   2) Arabam: tum fotograflar, saticinin aciklamasi, boya/degisen hasar matrisi.
echo   (Bu islem 7/24 motorda da kucuk partilerle kendiliginden yapilir.)
echo ====================================================================
echo.
set /p glimit="Kac aracin detaylari tamamlansin? (Varsayilan 35000 - Tum DB, Enter'a bas): "
if "%glimit%"=="" set glimit=35000
echo.
echo [1/2] Kurumsal kaynaklar (Otokoc, Otoplus) tamamlaniyor...
echo.
npx tsx scripts\enrich-details.ts %glimit%
echo.
echo [2/2] Arabam tamamlaniyor (ev IP'si gerekir)...
echo.
npx tsx scripts\enrich-arabam.ts %glimit%
echo.
pause
goto :eof

:mod11
echo.
echo ====================================================================
echo   ARABAM TUM ILANLARI DOGRULA VE SENKRONIZE ET
echo   - Olu/satilan ilanlar tespit edilir ve arsive kaldirilir.
echo   - Fiyat degisiklikleri kaynakla esitlenir.
echo   - Harici sunucu / ayri CMD penceresi ACILMAZ, tum islem burada calisir.
echo   - Istedigin an Ctrl+C ile durdurabilirsin (ilerleme kaydedilir).
echo ====================================================================
echo.
npx tsx scripts\sync-arabam.ts 11
echo.
pause
goto :eof

:mod8
echo.
echo ====================================================================
echo   ARABAM EN BAYAT 800 ILAN FIYAT TARAMASI
echo   - En uzun suredir guncellenmemis 800 ilan kontrol edilir.
echo   - Harici sunucu / ayri CMD penceresi ACILMAZ, tum islem burada calisir.
echo ====================================================================
echo.
npx tsx scripts\sync-arabam.ts 8
echo.
pause
goto :eof


:sitemap
echo.
echo ====================================================================
echo   ARABAM SITEMAP SENKRONU
echo   - Arabam'in arama motorlari icin yayinladigi 32 sitemap dosyasi okunur.
echo   - Arsivde olup hala yayinda gorunen ilanlar yeniden kontrole alinir.
echo   - Sitemap'te gorunmeyenler dogrulamada one alinir (tek basina silinmez).
echo ====================================================================
echo.
npx tsx scripts\arabam-sitemap.ts
echo.
pause
goto :eof

:envanter
echo.
echo ====================================================================
echo   KURUMSAL KAYNAKLAR TAM ENVANTER SENKRONU
echo   - Her kaynagin tum ilan listesi bastan sona taranir.
echo   - Fiyat/km degisiklikleri islenir, satilanlar arsive tasinir,
echo     geri gelenler yeniden yayina alinir.
echo ====================================================================
echo.
npx tsx scripts\reconcile-sources.ts
echo.
pause
goto :eof
