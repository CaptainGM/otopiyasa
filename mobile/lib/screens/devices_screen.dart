import 'package:flutter/material.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/utils/relative_time.dart';

/// CİHAZLARIM — web'deki profil sayfasındaki "Cihazlarım" bölümünün karşılığı.
/// Hesabın açık olduğu cihazlar listelenir; tanınmayan cihazın oturumu kapatılabilir.
class DevicesScreen extends StatefulWidget {
  const DevicesScreen({super.key});

  @override
  State<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends State<DevicesScreen> {
  final _api = ApiService();
  late Future<List<Map<String, dynamic>>> _sessions = _api.fetchSessions();
  String? _revoking;

  void _reload() => setState(() => _sessions = _api.fetchSessions());

  Future<void> _revoke(Map<String, dynamic> session) async {
    final id = session['id'].toString();
    final current = session['current'] == true;
    if (current) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Bu cihazdan çıkış'),
          content: const Text('Bu, şu an kullandığın cihaz. Çıkış yapmak istediğine emin misin?'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Vazgeç')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Çıkış yap')),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() => _revoking = id);
    try {
      final wasCurrent = await _api.revokeSession(id);
      if (!mounted) return;
      if (wasCurrent) {
        // Kendi oturumunu kapattı: profile geri dön, oturum zaten temizlendi.
        Navigator.of(context).popUntil((route) => route.isFirst);
        return;
      }
      _reload();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _revoking = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cihazlarım')),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _sessions,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(snapshot.error.toString().replaceFirst('Exception: ', ''), textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    OutlinedButton(onPressed: _reload, child: const Text('Tekrar dene')),
                  ],
                ),
              ),
            );
          }
          final sessions = snapshot.data ?? [];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Text(
                'Hesabına giriş yapılmış cihazlar. Tanımadığın bir cihaz görürsen çıkış yaptırabilirsin.',
                style: TextStyle(fontSize: 12, color: Colors.white54),
              ),
              const SizedBox(height: 12),
              if (sessions.isEmpty) const Text('Aktif cihaz bulunamadı.'),
              for (final s in sessions)
                Card(
                  child: ListTile(
                    leading: Icon(s['current'] == true ? Icons.smartphone : Icons.devices_other),
                    title: Text(s['deviceLabel']?.toString() ?? 'Bilinmeyen cihaz'),
                    subtitle: Text(
                      [
                        if (s['current'] == true) 'Bu cihaz',
                        if (DateTime.tryParse(s['lastSeenAt']?.toString() ?? '') != null)
                          'Son görülme: ${relativeTimeTr(DateTime.parse(s['lastSeenAt'].toString()))}',
                      ].join(' · '),
                    ),
                    trailing: _revoking == s['id'].toString()
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : TextButton(onPressed: () => _revoke(s), child: const Text('Çıkış yap')),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
