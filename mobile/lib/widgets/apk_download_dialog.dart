import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

/// Güncelleme APK'sını uygulamanın içinde indirir: ilerleme çubuğu, bitince sistem yükleyicisi, hata olursa yeniden deneme ve
/// tarayıcıda indirme yedeği. APK'yı Chrome'a bırakmak yerine bu kullanılır: Chrome indirme sonrası güvenlik denetiminde
/// "İndiriliyor…"da (23,29 / 23,29 MB) takılı kalabiliyordu.
class ApkDownloadDialog extends StatefulWidget {
  const ApkDownloadDialog({super.key, required this.apkUrl, required this.version, required this.onBrowserFallback});

  /// İndirilen dosyanın adı (önbellek dizininde; bkz. UpdateService.cleanupDownloads).
  static const fileName = 'otopiyasa-guncelleme.apk';

  final Uri apkUrl;
  final String version;
  final Future<void> Function() onBrowserFallback;

  @override
  State<ApkDownloadDialog> createState() => _ApkDownloadDialogState();
}

enum _Phase { downloading, ready, failed }

String _megabytes(int bytes) => (bytes / 1048576).toStringAsFixed(1).replaceAll('.', ',');

class _ApkDownloadDialogState extends State<ApkDownloadDialog> {
  _Phase _phase = _Phase.downloading;
  int _received = 0;
  int? _total;
  String _message = '';
  // Sistem yükleyicisine verme sonucu: pending | started | permission | error (bkz. _install).
  String _outcome = 'pending';
  String? _path;
  http.Client? _client;
  bool _cancelled = false;

  @override
  void initState() {
    super.initState();
    unawaited(_download());
  }

  @override
  void dispose() {
    _client?.close();
    super.dispose();
  }

  Future<void> _download() async {
    setState(() {
      _phase = _Phase.downloading;
      _received = 0;
      _total = null;
      _message = '';
      _cancelled = false;
    });
    final client = http.Client();
    _client = client;
    IOSink? sink;
    try {
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/${ApkDownloadDialog.fileName}');
      if (await file.exists()) await file.delete();
      final request = http.Request('GET', widget.apkUrl)..headers['Accept'] = 'application/octet-stream';
      final response = await client.send(request).timeout(const Duration(seconds: 30));
      if (response.statusCode != 200) throw 'Sunucu ${response.statusCode} yanıtı verdi.';
      final length = response.contentLength;
      final total = (length != null && length > 0) ? length : null;
      if (mounted) setState(() => _total = total);

      sink = file.openWrite();
      var received = 0;
      var lastPaint = DateTime.now();
      // Akış 30 sn durursa (bağlantı koptu) zaman aşımıyla düşer; sonsuza kadar "indiriliyor" kalmaz.
      await for (final chunk in response.stream.timeout(const Duration(seconds: 30))) {
        sink.add(chunk);
        received += chunk.length;
        final now = DateTime.now();
        if (mounted && now.difference(lastPaint).inMilliseconds >= 120) {
          lastPaint = now;
          setState(() => _received = received);
        }
      }
      await sink.flush();
      await sink.close();
      sink = null;
      if (total != null && received != total) {
        throw 'Dosya eksik indi (${_megabytes(received)} / ${_megabytes(total)} MB).';
      }
      if (received < 1024 * 1024) throw 'İndirilen dosya bir uygulama paketi gibi görünmüyor.';
      if (!mounted) return;
      setState(() {
        _received = received;
        _phase = _Phase.ready;
        _path = file.path;
      });
      await _install();
    } catch (error) {
      try {
        await sink?.close();
      } catch (_) {}
      if (!mounted || _cancelled) return;
      setState(() {
        _phase = _Phase.failed;
        _message = error is TimeoutException ? 'Bağlantı zaman aşımına uğradı.' : '$error';
      });
    } finally {
      client.close();
    }
  }

  /// MainActivity.installApk: APK'yı FileProvider ile sistem yükleyicisine verir. Bu uygulamanın "bilinmeyen kaynaklardan yükleme"
  /// izni yoksa Android'in o ayar ekranı açılır ve 'permission' döner.
  static const _channel = MethodChannel('otopiyasa/device');

  Future<void> _install() async {
    final path = _path;
    if (path == null) return;
    setState(() {
      _outcome = 'pending';
      _message = '';
    });
    var outcome = 'started';
    var message = '';
    try {
      outcome = await _channel.invokeMethod<String>('installApk', {'path': path}) ?? 'started';
    } on PlatformException catch (error) {
      outcome = 'error';
      message = error.message ?? 'Yükleme ekranı açılamadı.';
    } on MissingPluginException {
      outcome = 'error';
      message = 'Bu cihazda uygulama içi yükleme desteklenmiyor; "Tarayıcıda indir"i deneyin.';
    }
    if (!mounted) return;
    setState(() {
      _outcome = outcome;
      _message = message;
    });
  }

  /// İndirme bitince gösterilen metin: yükleme ekranının açılıp açılmadığına, izin gerekip gerekmediğine göre değişir
  /// (eskiden hepsi tek metinde çelişkili görünüyordu: "yükleme ekranı açıldı" ve "izin yok" birlikte).
  String get _readyText {
    final size = _megabytes(_received);
    switch (_outcome) {
      case 'permission':
        return 'Dosya indi ($size MB). Android, bu uygulamanın başka uygulama yüklemesine izin vermiyor: açılan ayar ekranında izni '
            'açıp buraya dönün ve "Yükle"ye dokunun.';
      case 'error':
        return 'Dosya indi ($size MB) ama yükleme ekranı açılamadı. $_message';
      case 'pending':
        return 'Dosya indi ($size MB). Yükleme ekranı açılıyor…';
      default:
        return 'Dosya indi ($size MB) ve yükleme ekranı açıldı. Açılmadıysa "Yükle"ye dokunun.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final onSurface = isDark ? Colors.white : const Color(0xFF0F172A);
    final muted = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final total = _total;
    final progress = total == null ? null : (_received / total).clamp(0.0, 1.0);

    final String title;
    switch (_phase) {
      case _Phase.downloading:
        title = 'Güncelleme indiriliyor';
      case _Phase.ready:
        title = 'İndirme tamamlandı';
      case _Phase.failed:
        title = 'İndirme tamamlanamadı';
    }

    return PopScope(
      canPop: _phase != _Phase.downloading,
      child: Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 14),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(
                    _phase == _Phase.failed ? Icons.error_outline : Icons.system_update_rounded,
                    color: _phase == _Phase.failed ? Colors.redAccent : const Color(0xFF2563EB),
                    size: 26,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      '$title · v${widget.version}',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: onSurface),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (_phase == _Phase.downloading) ...[
                LinearProgressIndicator(value: progress, minHeight: 6, borderRadius: BorderRadius.circular(3)),
                const SizedBox(height: 8),
                Text(
                  total == null
                      ? '${_megabytes(_received)} MB indirildi'
                      : '%${((progress ?? 0) * 100).round()} · ${_megabytes(_received)} / ${_megabytes(total)} MB',
                  style: TextStyle(fontSize: 13, color: muted),
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () {
                      _cancelled = true;
                      _client?.close();
                      Navigator.of(context).pop();
                    },
                    child: const Text('Vazgeç'),
                  ),
                ),
              ] else if (_phase == _Phase.ready) ...[
                Text(
                  _readyText,
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.45,
                    color: _outcome == 'permission' || _outcome == 'error' ? Colors.orangeAccent : muted,
                  ),
                ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  onPressed: _install,
                  icon: const Icon(Icons.install_mobile),
                  label: const Text('Yükle'),
                ),
                if (_outcome == 'error')
                  TextButton(
                    onPressed: () async {
                      Navigator.of(context).pop();
                      await widget.onBrowserFallback();
                    },
                    child: const Text('Tarayıcıda indir'),
                  ),
                TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Kapat')),
              ] else ...[
                Text(_message.isEmpty ? 'Bilinmeyen bir hata oluştu.' : _message, style: TextStyle(fontSize: 13, height: 1.45, color: muted)),
                const SizedBox(height: 14),
                FilledButton(onPressed: _download, child: const Text('Yeniden dene')),
                TextButton(
                  onPressed: () async {
                    Navigator.of(context).pop();
                    await widget.onBrowserFallback();
                  },
                  child: const Text('Tarayıcıda indir'),
                ),
                TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Kapat')),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
