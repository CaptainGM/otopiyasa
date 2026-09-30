@echo off
setlocal
chcp 65001 >nul
title OtoPiyasa - Android APK Builder
color 0b

echo ===============================================================
echo   OtoPiyasa - Android Release APK Builder
echo ===============================================================
echo.

where flutter >nul 2>&1
if errorlevel 1 goto no_flutter

cd /d "%~dp0mobile"
if errorlevel 1 goto no_mobile_directory

if exist "android\key.properties" (
    echo Signing: custom key from android\key.properties
) else (
    echo Signing: this computer's local Android debug key
    echo Intended for personal, manually installed APK updates.
)

echo.
echo [1/3] Resolving Flutter packages...
call flutter pub get
if errorlevel 1 goto package_error

echo.
echo [2/3] Building signed release APK...
call flutter build apk --release
if errorlevel 1 goto build_error

echo.
echo [3/3] Copying APK to the project root...
set "SOURCE_APK=%~dp0mobile\build\app\outputs\flutter-apk\app-release.apk"
set "DEST_APK=%~dp0otopiyasa-release.apk"
if not exist "%SOURCE_APK%" goto missing_apk
copy /y "%SOURCE_APK%" "%DEST_APK%" >nul
if errorlevel 1 goto copy_error

color 0a
echo.
echo APK created successfully:
echo %DEST_APK%
if not "%OTOPIYASA_NO_UI%"=="1" explorer /select,"%DEST_APK%"
if not "%OTOPIYASA_NO_UI%"=="1" pause
exit /b 0

:no_flutter
echo ERROR: Flutter is not available on PATH.
goto failed

:no_mobile_directory
echo ERROR: Could not enter the mobile project directory.
goto failed

:package_error
echo ERROR: flutter pub get failed.
goto failed

:build_error
echo ERROR: Flutter release build failed.
goto failed

:missing_apk
echo ERROR: The release APK output file was not found.
goto failed

:copy_error
echo ERROR: Could not copy the APK into the project root.
goto failed

:failed
color 0c
if not "%OTOPIYASA_NO_UI%"=="1" pause
exit /b 1
