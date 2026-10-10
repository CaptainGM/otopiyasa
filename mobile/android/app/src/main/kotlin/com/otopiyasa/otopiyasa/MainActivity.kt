package com.otopiyasa.otopiyasa

import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Flutter tarafına cihazın hangi işlemci mimarisini kullandığını söyler.
 *
 * Neden gerekli: yayın artık mimariye göre bölünmüş üç paket içeriyor (arm64 ~23 MB,
 * armeabi-v7a ~21 MB) ve tüm mimarileri kapsayan evrensel paket (~65 MB). Otomatik
 * güncelleme herkese evrensel paketi indirirse indirme ~3 katı olur; bu kanal sayesinde
 * sunucu cihaza uyan küçük paketi verebiliyor (bkz. src/lib/app-release.ts).
 *
 * Yalnızca bir dize döner ve hata durumunda Flutter tarafı evrensel pakete düşer, bu yüzden
 * kanal çalışmazsa güncelleme yine de yapılabilir kalır.
 */
class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "preferredAbi" -> result.success(preferredAbi())
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

    private companion object {
        const val CHANNEL = "otopiyasa/device"
    }
}
