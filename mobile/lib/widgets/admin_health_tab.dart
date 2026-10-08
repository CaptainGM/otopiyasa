import 'package:flutter/material.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';

/// Sistem sağlığı — web yönetim panelindeki SystemHealthCard'ın karşılığı. Sorun yoksa tek satır; varsa ne olduğu.
/// Aynı denetim saatte bir motorda çalışıp yöneticiye e-posta ve bildirim gönderir (bkz. src/lib/health-check.ts).
class AdminHealthTab extends StatefulWidget {
  const AdminHealthTab({super.key});

  @override
  State<AdminHealthTab> createState() => _AdminHealthTabState();
}

class _AdminHealthTabState extends State<AdminHealthTab> {
  late Future<Map<String, dynamic>> _future = ApiService().fetchAdminHealth();

  Future<void> _reload() async {
    setState(() => _future = ApiService().fetchAdminHealth());
    await _future.then((_) {}, onError: (_) {});
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return RefreshIndicator(
      onRefresh: _reload,
      child: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ListView(padding: const EdgeInsets.all(16), children: [
              Text(snapshot.error.toString().replaceFirst('Exception: ', ''), style: TextStyle(color: c.pricey)),
            ]);
          }
          final data = snapshot.data ?? {};
          final issues = (data['issues'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
          final checked = DateTime.tryParse(data['checkedAt']?.toString() ?? '')?.toLocal();
          final time = checked == null
              ? ''
              : '${checked.hour.toString().padLeft(2, '0')}:${checked.minute.toString().padLeft(2, '0')}';
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              if (issues.isEmpty)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.check_circle, color: c.cheap),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Sistem sağlıklı. Sunucu motoru, bekçi, kaynaklar ve ilan akışı normal ($time denetimi). '
                            'Bir şey bozulursa e-posta ve bildirim gelir.',
                            style: const TextStyle(fontSize: 13.5, height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else ...[
                Text('${issues.length} sorun bulundu ($time)', style: AppText.display(size: 17, color: c.pricey)),
                const SizedBox(height: 10),
                for (final issue in issues)
                  Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            issue['title']?.toString() ?? '',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14.5,
                              color: issue['severity'] == 'critical' ? c.pricey : AppTheme.accent,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(issue['detail']?.toString() ?? '', style: TextStyle(fontSize: 13, color: c.muted, height: 1.4)),
                        ],
                      ),
                    ),
                  ),
              ],
              const SizedBox(height: 8),
              Text(
                'Denetim saatte bir sunucu motorundan, günde bir Vercel zamanlayıcısından çalışır. Aynı sorun için günde en fazla bir bildirim gelir.',
                style: TextStyle(fontSize: 12, color: c.faint, height: 1.4),
              ),
            ],
          );
        },
      ),
    );
  }
}
