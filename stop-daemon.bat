@echo off
title OtoPiyasa - Scraper Durdurucu
cd /d "%~dp0"

echo ===============================================================
echo   OtoPiyasa 7/24 Scraper Durduruluyor...
echo ===============================================================
echo.

powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*scripts/daemon.ts*' -or $_.CommandLine -like '*daemon.ts*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('[OK] Scraper Motoru Durduruldu (PID: ' + $_.ProcessId + ')') }"

echo.
call npx tsx scripts/stop-daemon.ts

echo.
echo ===============================================================
echo   Durdurma islemi tamamlandi.
echo   Yeniden baslatmak icin run-daemon.bat dosyasina tiklayabilirsin.
echo ===============================================================
echo.
pause
