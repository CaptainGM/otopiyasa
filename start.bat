@echo off
setlocal enabledelayedexpansion
title OtoPiyasa - Baslatiliyor
cd /d "%~dp0"

echo ============================================
echo   OtoPiyasa - Baslatma Scripti
echo ============================================
echo.

REM --- Node.js kontrolu ---
where node >nul 2>nul
if errorlevel 1 (
    echo [HATA] Node.js bulunamadi.
    echo Lutfen https://nodejs.org adresinden Node.js LTS surumunu kurup tekrar deneyin.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo [OK] Node.js bulundu: %%v

REM --- .env kontrolu ---
if not exist ".env" (
    if exist ".env.example" (
        echo [BILGI] .env bulunamadi, .env.example kopyalaniyor...
        copy ".env.example" ".env" >nul
    ) else (
        echo [UYARI] .env ve .env.example bulunamadi, lutfen elle olusturun.
    )
)

REM --- node_modules kontrolu ---
if not exist "node_modules" (
    echo [BILGI] node_modules bulunamadi, npm install calistiriliyor...
    echo         ^(Not: postinstall Playwright/Chromium indirir, epey buyuk olabilir^)
    call npm install
    if errorlevel 1 (
        echo [HATA] npm install basarisiz oldu.
        pause
        exit /b 1
    )
)

REM --- MongoDB kontrolu ---
sc query MongoDB >nul 2>nul
if not errorlevel 1 (
    echo [BILGI] MongoDB servisi bulundu, baslatiliyor...
    net start MongoDB >nul 2>nul
    echo [OK] MongoDB servisi hazir.
) else (
    where mongod >nul 2>nul
    if not errorlevel 1 (
        echo [BILGI] MongoDB servis olarak kurulu degil, mongod arka planda baslatiliyor...
        start "MongoDB" /min mongod
        timeout /t 3 >nul
    ) else (
        echo [HATA] MongoDB bulunamadi ^(ne Windows servisi ne de mongod komutu^).
        echo Lutfen https://www.mongodb.com/try/download/community adresinden kurun,
        echo ya da .env icindeki MONGODB_URI'yi bir MongoDB Atlas baglantisiyla degistirin.
        echo.
        pause
        exit /b 1
    )
)

echo.
echo ============================================
echo   Sunucu baslatiliyor: http://localhost:3000
echo ============================================
echo.

call npm run dev

pause
