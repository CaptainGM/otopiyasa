@echo off
title OtoPiyasa - Arabam Bekcisi Durum
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\arabam-bekci.ps1" durum
echo.
pause
