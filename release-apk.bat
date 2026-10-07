@echo off
setlocal
chcp 65001 >nul
title OtoPiyasa - Mobil surum yayinla
cd /d "%~dp0"
rem Once mobile\pubspec.yaml icindeki surumu artir (or. 1.0.6+7 -> 1.0.7+8). Ayrintilar: scripts\release-apk.mjs
node scripts\release-apk.mjs %*
if errorlevel 1 (
  echo.
  echo HATA: surum yayinlanamadi.
)
if not "%OTOPIYASA_NO_UI%"=="1" pause
