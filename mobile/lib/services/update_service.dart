import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:otopiyasa/services/api_service.dart';

class UpdateService {
  /// Mevcut uygulamanın sürüm ve derleme numarası.
  /// pubspec.yaml içerisindeki version (1.0.2+3) ile uyumludur.
  static const String currentVersionName = '1.0.2';
  static const int currentVersionCode = 3;

  static bool _dialogShowing = false;

  /// Sunucudaki en son sürümü denetler.
  /// [manual]: Kullanıcı profilden "Güncellemeleri Denetle" butonuna bastıysa true verilir.
  static Future<void> checkUpdate(
    BuildContext context, {
    bool manual = false,
  }) async {
    if (!context.mounted) return;

    if (manual) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Güncellemeler denetleniyor…'),
          duration: Duration(seconds: 1),
        ),
      );
    }

    try {
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
      final title = data['title']?.toString() ?? 'OtoPiyasa Güncellemesi Hazır! 🚀';
      final forceUpdate = data['forceUpdate'] == true;

      if (remoteCode > currentVersionCode) {
        if (_dialogShowing) return;
        _showUpdateDialog(
          context,
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
                      _startDownload(context, apkUrl);
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

  static Future<void> _startDownload(BuildContext context, String apkUrl) async {
    final uri = Uri.tryParse(apkUrl);
    if (uri == null) {
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
