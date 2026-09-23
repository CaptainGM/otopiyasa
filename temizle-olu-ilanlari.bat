@echo off
title OtoPiyasa - Olu Ilan Temizleme Motoru
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [HATA] Node.js bulunamadi. Lutfen Node.js kurun.
    pause
    exit /b 1
)

echo ====================================================================
echo             OTOPIYASA - KALICI OLU ILAN TEMIZLEME MOTORU
echo ====================================================================
echo.
echo   Bu script veritabanindaki en eski/bayat ilanlari canli testten gecirir.
echo   - Yayindan kalkmis / satilmis ilanlari tespit eder ve "Piyasa Arsivi"ne tasir.
echo   - Canli ilanlari dogrular ve sistemde guncel tutar.
echo   - Cloudflare ve hiz sinirina takilmaz (Gerekirse Chromium devreye girer).
echo.

call npx tsx scripts/sweep-dead-listings.ts %1

echo.
pause
