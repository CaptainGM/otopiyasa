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
echo  [★] EN HIZLI SERI CEKIM (50.000 Canli Ilan Hedefi: once marka, sonra model model)
echo   ------------------------------------------------------------------
echo    T  - TURBO SERI CEKIM   (Sayfa basina 20 arac direkt iceri; marka turu + model turu)
echo    2  - TURBO Arabam Cekim (Tum vasita kategorileri + 40 marka)
echo    K  - KATEGORI CEKIMI    (Motosiklet, Ticari, SUV/Pickup, Minivan, Karavan: secilen kategorinin tamami)
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
echo    20 - Seyrek piyasa emsali (Aykiri deger sonrasi 3'ten az marka/model/yil ilani)
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
echo    N  - Arabam Yeni Ilanlar (sitemap'ten en yeni ilanlari bul ve tam detayla ekle)
echo    S  - Arabam Sitemap     (32 sitemap dosyasi, ~2 dk; dogrulama onceligi icin)
echo    E  - Kurumsal Envanter  (Otokoc, DOD, VavaCars... tum envanteri senkronla)
echo.
echo    G  - GALERI ^& ACIKLAMA  (Arabam + kurumsal kaynaklar: tum fotograf, aciklama, tramer/boya)
echo    D  - EKSIK DETAY TARAMASI (DB'yi tara: kac ilanda ne eksik, raporla ve tamamla)
echo    P  - PARALEL MOD        (Iki modu ayni anda calistir, ornegin 11 + 12)
echo ====================================================================
echo.
set /p secim="Secimin (T, K, G, D, N, S, E, 1-20 veya P, varsayilan T): "
if "%secim%"=="" set secim=T

if /i "%secim%"=="T" goto :turbo
if "%secim%"=="2" goto :turbo
if /i "%secim%"=="K" goto :kategori
if /i "%secim%"=="G" goto :galeri
if /i "%secim%"=="D" goto :eksikdetay
if "%secim%"=="11" goto :mod11
if "%secim%"=="8" goto :mod8
rem 10 ve 14 eski "tam yenileme / stealth" modlariydi; artik ayni isi 11 yapiyor.
if "%secim%"=="10" goto :mod11
if "%secim%"=="14" goto :mod11
if /i "%secim%"=="S" goto :sitemap
if /i "%secim%"=="N" goto :yeniilan
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
set /p hedef="Hedef yeni ilan adedi (Varsayilan 50000, direk baslatmak icin Enter): "
if "%hedef%"=="" set hedef=50000
echo   Not: Arabam bekcisi tarama bitene kadar bekler, sonra kendiliginden devam eder.
set /p tdetay="Yeni ilanlarin kendi sayfasi da acilsin mi? E = galeri ve kasa tipi gelir ama cok yavas, H = hizli, galeriyi bekci tamamlar (E/H, varsayilan H): "
set tflag=--detaysiz
if /i "%tdetay%"=="E" set tflag=
echo.
echo [BASLATILIYOR] %hedef% taze ilan icin Turbo Motor devreye giriyor...
echo.
npx tsx scripts\turbo-arabam.ts %hedef% "" %tflag%
echo.
pause
goto :eof

:kategori
echo.
echo ====================================================================
echo   KATEGORI CEKIMI (az ilanli kategorilerin tamami)
echo   1 - Motosiklet
echo   2 - Ticari Araclar (kamyon, kamyonet, minibus, otobus)
echo   3 - Arazi, SUV ve Pickup
echo   4 - Minivan ve Panelvan
echo   5 - Karavan
echo   6 - Hepsi (otomobil haric)
echo   Not: Arabam bekcisi bu tarama sirasinda KENDILIGINDEN BEKLER; tarama bitince
echo   (ya da pencereyi kapatinca) kendiliginden devam eder. Elle bir sey yapma.
echo ====================================================================
echo.
set /p kat="Kategori (1-6, varsayilan 6): "
if "%kat%"=="" set kat=6
set katlist=motosiklet,ticari-araclar,arazi-suv-pick-up,minivan-panelvan,karavan
if "%kat%"=="1" set katlist=motosiklet
if "%kat%"=="2" set katlist=ticari-araclar
if "%kat%"=="3" set katlist=arazi-suv-pick-up
if "%kat%"=="4" set katlist=minivan-panelvan
if "%kat%"=="5" set katlist=karavan
set /p khedef="Hedef yeni ilan adedi (varsayilan 5000): "
if "%khedef%"=="" set khedef=5000
set /p kdetay="Yeni ilanlarin kendi sayfasi da acilsin mi? Galeri ve kasa tipi gelir ama yavaslar (E/H, varsayilan E): "
set kflag=
if /i "%kdetay%"=="H" set kflag=--detaysiz
echo.
npx tsx scripts\turbo-arabam.ts %khedef% %katlist% %kflag%
echo.
pause
goto :eof

:galeri
echo.
echo ====================================================================
echo   TAM DETAY, GALERI ^& HASAR TAMAMLAMA MOTORU
echo   1) Kurumsal kaynaklar (Otokoc, Otoplus, DOD, Carvak, Otomerkezi): tum fotograflar,
echo      tramer, boya/degisen, renk, kasa tipi ve motor hacmi.
echo   2) Arabam: tum fotograflar, saticinin aciklamasi, boya/degisen hasar matrisi.
echo   (Bu islem 7/24 motorda da kucuk partilerle kendiliginden yapilir.)
echo ====================================================================
echo.
set /p glimit="Kac aracin detaylari tamamlansin? (Varsayilan 35000 - Tum DB, Enter'a bas): "
if "%glimit%"=="" set glimit=35000
echo.
echo [1/2] Kurumsal kaynaklar (Otokoc, Otoplus, DOD, Carvak, Otomerkezi) tamamlaniyor...
echo.
npx tsx scripts\enrich-details.ts %glimit%
echo.
echo [2/2] Arabam tamamlaniyor (ev IP'si gerekir)...
echo.
npx tsx scripts\enrich-arabam.ts %glimit%
echo.
pause
goto :eof

:eksikdetay
echo.
echo ====================================================================
echo   EKSIK DETAY TARAMASI
echo   1) Tum aktif ilanlar taranir: fotograf, aciklama, km, fiyat, konum,
echo      hasar/boya, motor ve beygir bilgisi kac ilanda eksik raporlanir.
echo   2) Ilan detayi okunabilen kaynaklarda (Arabam ve kurumsal kaynaklar) eksikler
echo      tamamlanir; satilmis ilanlar arsive tasinir. Ctrl+C ile guvenle durur.
echo ====================================================================
echo.
set dlimit=
set /p dlimit="Kac ilan tamamlansin? (Enter = hepsi, R = yalnizca rapor): "
if /i "%dlimit%"=="R" (
    npx tsx scripts\complete-details.ts --rapor
) else (
    npx tsx scripts\complete-details.ts %dlimit%
)
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


:yeniilan
echo.
echo ====================================================================
echo   ARABAM YENI ILANLAR (SITEMAP)
echo   - Arabam'in sitemap'inden bizde olmayan EN YENI ilanlar bulunur.
echo   - Her ilanin detay sayfasi gercek tarayiciyla acilir: tum fotograflar,
echo     aciklama, hasar/boya bilgisi. (robots.txt'e uygun: kategori gezilmez.)
echo   - Ev IP'si gerekir. Kuyruk bos ise once sitemap okunur (~2 dk).
echo ====================================================================
echo.
set /p nlimit="Kac yeni ilan eklensin? (Varsayilan 200): "
if "%nlimit%"=="" set nlimit=200
npx tsx scripts\arabam-discover.ts %nlimit%
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
