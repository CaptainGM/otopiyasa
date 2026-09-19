@echo off
chcp 65001 >nul
title OtoPiyasa - Mobil APK Derleme Aracı
color 0b

echo ===============================================================
echo   🚗 OtoPiyasa - Mobil Android APK Oluşturucu (Release Mode)
echo ===============================================================
echo.
echo   [1/4] Ortam ve Flutter araçları kontrol ediliyor...
echo.

where flutter >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0c
    echo [HATA] Flutter komutu bulunamadi!
    echo Lutfen Flutter SDK'nin PATH ortam degiskenine eklendiginden emin olun.
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0mobile"

echo   [2/4] Paket bağımlılıkları güncelleniyor (flutter pub get)...
call flutter pub get
if %ERRORLEVEL% NEQ 0 (
    color 0c
    echo.
    echo [HATA] Paketler indirilemedi! Lutfen internet baglantinizi kontrol edin.
    echo.
    pause
    exit /b 1
)

echo.
echo   [3/4] Release APK derleniyor (Bu işlem 1-3 dakika sürebilir)...
echo         Lütfen bekleyin...
echo.

call flutter build apk --release
if %ERRORLEVEL% NEQ 0 (
    color 0c
    echo.
    echo [HATA] APK derleme sırasında bir hata oluştu!
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0"

set "SOURCE_APK=%~dp0mobile\build\app\outputs\flutter-apk\app-release.apk"
set "DEST_APK=%~dp0otopiyasa-release.apk"

if exist "%SOURCE_APK%" (
    copy /y "%SOURCE_APK%" "%DEST_APK%" >nul
    color 0a
    echo.
    echo ===============================================================
    echo   ✅ TEBRİKLER! APK BAŞARIYLA OLUŞTURULDU!
    echo ===============================================================
    echo.
    echo   📁 Dosya Konumu:
    echo      %DEST_APK%
    echo.
    echo   📱 TELEFONA YÜKLEME ADIMLARI:
    echo      1. Bu APK dosyasını WhatsApp (Kendine Mesaj), Google Drive
    echo         veya USB kablosu ile Android telefonuna gönder.
    echo      2. Telefonda dosyayı açıp 'Yükle' (veya 'Yine de Yükle') butonuna bas.
    echo      3. Uygulamayı aç: 20.780 canlı ilan ve 7/24 Frankfurt Bot Takibi
    echo         artık bilgisayara ihtiyaç duymadan cebinde!
    echo.
    echo ===============================================================
    echo.
    echo Klasör açılıyor...
    explorer /select,"%DEST_APK%"
) else (
    color 0c
    echo [HATA] Derlenen APK dosyası bulunamadı!
)

echo.
pause
