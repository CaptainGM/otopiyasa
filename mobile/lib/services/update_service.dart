import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/widgets/apk_download_dialog.dart';

/// Güncelleme zorunlu mu?
///
/// Sunucu yanıtı CDN'de herkese ortak saklandığı için `forceUpdate` alanı istemciye göre
/// değişemez (bu yüzden sunucu her zaman false gönderir). Karar burada verilir: sunucu
/// `minVersionCode` eşiğini yayınlar, istemci kendi derleme numarasıyla karşılaştırır.
/// Bozuk bir sürüm geri çekilmek istendiğinde sunucuda APP_MIN_VERSION_CODE yükseltilir.
bool isForceUpdateRequired({required int currentVersionCode, required Map<String, dynamic> data}) {
  if (data['forceUpdate'] == true) return true;
  final minCode = (data['minVersionCode'] as num?)?.toInt() ?? 0;
  return minCode > 0 && releaseNumber(currentVersionCode) < minCode;
}

/// Android sürüm kodundan yayın numarasını çıkarır. Flutter, mimariye bölünmüş paketlerde kodu "mimari × 1000 + yayın numarası"
/// yapar (arm64-v8a: 2022, armeabi-v7a: 1022); evrensel pakette yayın numarasının kendisidir (22). Karşılaştırma yayın numarası
/// üzerinden yapılır: ham kodla karşılaştırınca bölünmüş paketi kuran telefon 2022'yi "çok yeni" sanıp sonraki sürümleri (23, 24…)
/// hiç görmüyordu (emülatörde doğrulandı: "Derleme 2022"). Sunucu da bölünmüş paket için ham kod bildirir (bkz. src/lib/app-release.ts
/// packageVersionCode); iki taraf da indirgendiği için her ölçekte doğru çalışır. Yayın numarası 1000'e ulaşırsa gözden geçirilmeli.
int releaseNumber(int androidVersionCode) => androidVersionCode % 1000;

/// Sunucudaki sürüm yüklü olandan yeni mi? (ikisi de yayın numarasına indirgenir)
bool isUpdateAvailable({required int installedCode, required int remoteCode}) =>
    releaseNumber(remoteCode) > releaseNumber(installedCode);

class UpdateService {
  /// Yüklü uygulamanın gerçek sürümü (APK'nın kendisinden okunur, pubspec.yaml version: 1.0.6+7 → 1.0.6 / 7).
  /// Eskiden burada elle yazılmış '1.0.2 / 3' duruyordu ve hiç güncellenmediği için her telefon kendini
  /// 1.0.2 sanıyordu: güncelleme denetimi hep yanlış sonuç veriyordu.
  static PackageInfo? _info;
  static Future<PackageInfo> packageInfo() async => _info ??= await PackageInfo.fromPlatform();

  static bool _dialogShowing = false;

  /// Sunucudaki en son sürümü denetler.
  /// [manual]: Kullanıcı profilden "Güncellemeleri Denetle" butonuna bastıysa true verilir.
  static Future<void> checkUpdate(
    BuildContext context, {
    bool manual = false,
  }) async {
    if (!context.mounted) return;
    // Önceki güncellemeden kalan APK önbellekte yer tutmasın.
    unawaited(cleanupDownloads());

    if (manual) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Güncellemeler denetleniyor…'),
          duration: Duration(seconds: 1),
        ),
      );
    }

    try {
      final info = await packageInfo();
      final currentVersionName = info.version;
      // Ham Android kodu mimari payı taşıyabilir (2022); karşılaştırma yayın numarasıyla yapılır (bkz. releaseNumber).
      final currentVersionCode = releaseNumber(int.tryParse(info.buildNumber) ?? 0);
      final data = await ApiService().checkAppVersion();
      if (!context.mounted) return;

      if (data == null) {
        if (manual) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Güncelleme sunucusuna ulaşılamadı.'),
              backgroundColor: Colors.orange,
            ),
          );
        }
        return;
      }

      final remoteCode = (data['versionCode'] as num?)?.toInt() ?? 0;
      final remoteVersion = data['version']?.toString() ?? 'Yeni Sürüm';
      final apkUrl = data['apkUrl']?.toString() ?? '';
      final changelog = data['changelog']?.toString() ?? '';
      final title = data['title']?.toString() ?? 'OtoPiyasa Güncellemesi Hazır!';
      // Zorunluluk istemcide hesaplanır (bkz. isForceUpdateRequired): minVersionCode eşiğinin
      // altındaki sürümler güncelleme ekranında kilitlenir.
      final forceUpdate = isForceUpdateRequired(currentVersionCode: currentVersionCode, data: data);

      if (isUpdateAvailable(installedCode: currentVersionCode, remoteCode: remoteCode)) {
        if (_dialogShowing) return;
        _showUpdateDialog(
          context,
          currentVersionName: currentVersionName,
          remoteVersion: remoteVersion,
          apkUrl: apkUrl,
          changelog: changelog,
          title: title,
          forceUpdate: forceUpdate,
        );
      } else if (manual) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.greenAccent, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Uygulamanız güncel! (v$currentVersionName - Derleme $currentVersionCode)',
                  ),
                ),
              ],
            ),
            backgroundColor: const Color(0xFF1E293B),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (manual && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Hata oluştu: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  static void _showUpdateDialog(
    BuildContext context, {
    required String currentVersionName,
    required String remoteVersion,
    required String apkUrl,
    required String changelog,
    required String title,
    required bool forceUpdate,
  }) {
    _dialogShowing = true;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showDialog(
      context: context,
      barrierDismissible: !forceUpdate,
      builder: (ctx) {
        return PopScope(
          canPop: !forceUpdate,
          child: Dialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
            elevation: 8,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Başlık ve İkon
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF2563EB), Color(0xFF7C3AED)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(
                          Icons.system_update_rounded,
                          color: Colors.white,
                          size: 26,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                                color: isDark ? Colors.white : const Color(0xFF0F172A),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'v$currentVersionName ➔ v$remoteVersion',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // Yenilikler Başlığı
                  Text(
                    'Yenilikler & İyileştirmeler:',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: isDark ? const Color(0xFFCBD5E1) : const Color(0xFF334155),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Değişiklik Listesi Kartı
                  Container(
                    constraints: const BoxConstraints(maxHeight: 180),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                      ),
                    ),
                    child: SingleChildScrollView(
                      child: Text(
                        changelog.isNotEmpty
                            ? changelog
                            : '• Performans ve kararlılık geliştirmeleri yapıldı.',
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.5,
                          color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF1E293B),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Butonlar
                  FilledButton.icon(
                    onPressed: () async {
                      Navigator.of(ctx).pop();
                      _startDownload(context, apkUrl, remoteVersion);
                    },
                    icon: const Icon(Icons.download_rounded, size: 20),
                    label: const Text(
                      'Şimdi Güncelle',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      backgroundColor: const Color(0xFF2563EB),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),

                  if (!forceUpdate) ...[
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: Text(
                        'Daha Sonra',
                        style: TextStyle(
                          color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    ).then((_) {
      _dialogShowing = false;
    });
  }

  /// Güncellemeyi uygulamanın içinde indirir (ilerleme çubuğuyla) ve bitince sistem yükleyicisini açar. Android dışında ya da
  /// uygulama içi indirme kurulamıyorsa tarayıcıya düşer. Eskiden APK doğrudan Chrome'a bırakılıyordu: Chrome indirme sonrası
  /// güvenlik denetiminde "İndiriliyor…"da (23,29 / 23,29 MB) takılı kalabiliyor, kullanıcı güncellemeyi hiç yükleyemiyordu.
  static Future<void> _startDownload(BuildContext context, String apkUrl, String version) async {
    final uri = Uri.tryParse(apkUrl);
    if (uri == null || !uri.hasScheme) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Geçersiz indirme bağlantısı.'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
      return;
    }
    if (!Platform.isAndroid) {
      await _openInBrowser(context, uri);
      return;
    }
    if (!context.mounted) return;
    _downloadActive = true;
    try {
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => ApkDownloadDialog(apkUrl: uri, version: version, onBrowserFallback: () => _openInBrowser(context, uri)),
      );
    } finally {
      _downloadActive = false;
    }
  }

  /// İndirme penceresi açıkken indirilen dosya silinmesin (kullanıcı "Yükle"ye yeniden dokunabilir).
  static bool _downloadActive = false;

  /// Bu sürümden önce indirilmiş ve yüklenmiş/yarım kalmış güncelleme dosyasını siler (önbellek şişmesin).
  static Future<void> cleanupDownloads() async {
    if (_downloadActive) return;
    try {
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/${ApkDownloadDialog.fileName}');
      if (await file.exists()) await file.delete();
    } catch (_) {
      // temizlik başarısızsa sorun değil: dosya sistem tarafından da silinir
    }
  }

  static Future<void> _openInBrowser(BuildContext context, Uri uri) async {
    try {
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );

      if (launched && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.file_download, color: Colors.white, size: 22),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'İndirme başlatıldı! Bildirim çubuğundan tamamlandığında dokunup güncelleyebilirsiniz.',
                    style: TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
            duration: Duration(seconds: 5),
            backgroundColor: Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
          ),
        );
      } else if (!launched && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('İndirme başlatılamadı. Tarayıcıda açmayı deneyin.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('İndirme hatası: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }
}
