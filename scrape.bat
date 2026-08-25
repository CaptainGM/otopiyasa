@echo off
title OtoPiyasa - Veri Cekme
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [HATA] Node.js bulunamadi. Once Node.js kurulu oldugundan emin ol.
    pause
    exit /b 1
)

echo ============================================
echo   OtoPiyasa - Veri Cekme
echo ============================================
echo.
echo   1 - Hizli guncelleme  (Arabam 30 + Otomerkezi 60, ~5 dk)
echo   2 - Genis tarama      (Arabam ~1000 ilan, 60-90 dk, yuksek veri!)
echo   3 - Otomerkezi        (tam envanter ~250 ilan, ~2 dk)
echo   4 - Nadir marka       (az/hic ilani olan markalari derin tarar)
echo   5 - En az markalar    (yalniz cok az ilanli markalari 20 sayfa DERIN)
echo   6 - Nadir MODEL       (^<10 ilanli marka+model segmentleri - fiyat modelini iyilestirir)
echo   7 - Nadir MODEL genis (^<15 ilanli, 300 segment, daha derin)
echo   8 - Fiyat taramasi   (var olan ilanlarin fiyatini kaynakla esitler)
echo   9 - Adres tamamlama  (adressiz eski ilanlarin ilcesini doldurur - HARITA icin)
echo   10- TAM YENILEME     (TUM ilanlar: hasar bolgesi+fiyat+govde tipi, 10-15 SAAT,
echo                          istedigin an kapat, ertesi gun "10" secince devam eder)
echo.
set /p secim="Secimin (1/2/3/4/5/6/7/8/9/10, varsayilan 1): "
if "%secim%"=="" set secim=1

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

echo.
node scripts\scrape.mjs %secim%

echo.
echo Not: veri cekme bitti. Sunucu ayri pencerede acik kaldi;
echo siteyi kullanmaya devam edebilir ya da o pencereyi kapatabilirsin.
pause
