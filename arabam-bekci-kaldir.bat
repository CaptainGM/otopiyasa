@echo off
title OtoPiyasa - Arabam Bekcisi Kaldir
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\arabam-bekci.ps1" kaldir
echo.
pause
