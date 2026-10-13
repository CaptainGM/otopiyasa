package com.otopiyasa.otopiyasa

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * Flutter tarafına iki şey sunar:
 *
 * 1) preferredAbi — cihazın işlemci mimarisi. Yayın mimariye göre bölünmüş üç paket içeriyor (arm64 ~23 MB, armeabi-v7a ~21 MB)
 *    ve tüm mimarileri kapsayan evrensel paket (~65 MB). Otomatik güncelleme herkese evrensel paketi indirirse indirme ~3 katı
 *    olur; bu kanal sayesinde sunucu cihaza uyan küçük paketi verebiliyor (bkz. src/lib/app-release.ts). Yalnızca bir dize
 *    döner ve hata durumunda Flutter tarafı evrensel pakete düşer.
 *
 * 2) installApk — uygulamanın içinde indirilen güncelleme APK'sını sistem yükleyicisiyle açar. Eskiden APK Chrome'a bırakılıyordu;
 *    Chrome indirme sonrası güvenlik denetiminde "İndiriliyor…"da (23,29 / 23,29 MB) takılı kalabiliyor, güncelleme yüklenemiyordu.
 *    Bu uygulamanın "bilinmeyen kaynaklardan yükleme" izni yoksa (Android 8+) o ayar ekranı açılır ve "permission" döner;
 *    izin verilince kullanıcı "Yükle"ye yeniden dokunur.
 */
class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "preferredAbi" -> result.success(preferredAbi())
                    "installApk" -> installApk(call.argument<String>("path"), result)
                    else -> result.notImplemented()
                }
            }
    }

    /**
     * Desteklenen mimariler öncelik sırasına göredir (ilk eleman en uygun olan).
     * Flutter'ın ürettiği paket adlarıyla eşleşen ilk değer döner: arm64-v8a, armeabi-v7a.
     * Eşleşme yoksa null döner ve istemci evrensel paketi ister.
     */
    private fun preferredAbi(): String? {
        val supported = Build.SUPPORTED_ABIS ?: return null
        return supported.firstOrNull { it == "arm64-v8a" || it == "armeabi-v7a" }
    }

    private fun installApk(path: String?, result: MethodChannel.Result) {
        if (path.isNullOrEmpty()) {
            result.error("ARG", "APK yolu verilmedi", null)
            return
        }
        try {
            val file = File(path)
            if (!file.exists()) {
                result.error("MISSING", "İndirilen dosya bulunamadı", null)
                return
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
                startActivity(
                    Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName"))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
                result.success("permission")
                return
            }
            val uri = FileProvider.getUriForFile(this, "$packageName.updates", file)
            val intent = Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
            result.success("started")
        } catch (error: Exception) {
            result.error("INSTALL", error.message ?: error.toString(), null)
        }
    }

    private companion object {
        const val CHANNEL = "otopiyasa/device"
    }
}
