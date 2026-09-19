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
echo    11 - Dogrula ve Yenile  (Olu/satilan ilanlari DB'den kaldir, fiyat esitle)
echo    8  - Fiyat Taramasi     (En bayat 800 ilanin fiyatini kaynakla esitle)
echo    9  - Adres Tamamlama    (Ilcesi eksik ilanlarin adresini doldur - Harita)
echo    10 - TAM DB Yenileme    (Hasar parcalari + Govde tipi + Fiyat tam revizyon)
echo    14 - 24 Saat Stealth    (Dakikada 10 ilan, 6 sn insansi aralik, 0 blok)
echo.
echo    G  - GALERI ^& ACIKLAMA  (Mevcut ilanlarin 20 HD fotograf ve aciklamasini cek)
echo    P  - PARALEL MOD        (Iki modu ayni anda calistir, ornegin 11 + 12)
echo ====================================================================
echo.
set /p secim="Secimin (T, G, 1-19 veya P, varsayilan T): "
if "%secim%"=="" set secim=T

if /i "%secim%"=="T" goto :turbo
if "%secim%"=="2" goto :turbo
if /i "%secim%"=="G" goto :galeri

if "%secim%"=="14" (
    set SCRAPE_MIN_INTERVAL_MS=5500
    set SCRAPE_CONCURRENCY=1
    set DISABLE_ZENROWS=true
)

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
echo   ARABAM TAM DETAY, GALERI ^& HASAR TAMAMLAMA MOTORU
echo   Veritabanindaki ilanlarin eksiksiz TUM fotograflarini,
echo   saticinin gercek detayli aciklamasini, boya/degisen hasar matrisini,
echo   motor gucu, hacmi ve diger tum ozelliklerini paralel olarak ceker.
echo ====================================================================
echo.
set /p glimit="Kac aracin detaylari tamamlansin? (Varsayilan 35000 - Tum DB, Enter'a bas): "
if "%glimit%"=="" set glimit=35000
echo.
echo [BASLATILIYOR] %glimit% arac icin eksiksiz tum detaylar cekilip veritabanina kaydediliyor...
echo.
npx tsx scripts\enrich-arabam.ts %glimit%
echo.
pause
goto :eof


