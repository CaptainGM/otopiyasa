@echo off
title OtoPiyasa - 7/24 Otonom Scraper Motoru
cd /d "%~dp0"

set DISABLE_ZENROWS=true
set SCRAPE_CONCURRENCY=1
set SCRAPE_MIN_INTERVAL_MS=4500

echo ===============================================================
echo   OtoPiyasa - 7/24 Kesintisiz Otonom Scraper ^& Temizleyici
echo ===============================================================
echo   FAZ 1: En Eski Ilanlari Dogrulama ^& Olu Ilan Temizligi (250'serli Paketler)
echo   FAZ 2: 5'li Kurumsal Envanter (Otomerkezi, VavaCars, Otoplus, Carvak)
echo   FAZ 3: Hizli Yeni Ilan Kesfi (Arabam En Yeniler)
echo   MOD  : 0 Blok Stealth (Tek kanal, 4.5s insansi ritim, ZenRows yok)
echo.
echo Motor baslatiliyor...
echo.

call npx tsx scripts/start-daemon.ts
npx tsx scripts/daemon.ts

pause
