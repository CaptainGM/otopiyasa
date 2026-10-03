@echo off
title OtoPiyasa - Arabam Bekcisi Kur
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\arabam-bekci.ps1" kur
echo.
pause
