@echo off
title OtoPiyasa - Otonom Motoru Yeniden Baslat
cd /d "%~dp0"

echo ====================================================================
echo      OTOPIYASA - 7/24 OTONOM MOTORU YENIDEN BASLATMA KOMUTU
echo ====================================================================
echo.
echo   Sunucudaki daemon motoruna uzaktan yeniden baslama emri gonderiliyor...
echo.

call npx tsx scripts/restart-daemon.ts

echo.
timeout /t 5
