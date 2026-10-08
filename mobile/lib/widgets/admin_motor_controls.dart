import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';

/// Sunucu motoru kontrolü — web yönetim panelindeki Başlat / Durdur / Yeniden başlat düğmeleri ve çalışma modu
/// seçimi (bkz. DaemonStatsPanel.tsx). Düğme motora yalnızca komut bırakır; taramayı Oracle'daki motor yapar.
class AdminMotorControls extends StatefulWidget {
  const AdminMotorControls({super.key, required this.daemon, required this.onChanged});

  final Map<String, dynamic> daemon;

  /// Komut gönderildikten sonra paneli yenilemek için.
  final Future<void> Function() onChanged;

  @override
  State<AdminMotorControls> createState() => _AdminMotorControlsState();
}

class _AdminMotorControlsState extends State<AdminMotorControls> {
  final _api = ApiService();
  bool _busy = false;

  static const _modes = <(String, String, String, IconData)>[
    ('hybrid', 'Dengeli', 'Yeni ilan keşfi ve ölü ilan temizliği birlikte', Icons.balance),
    ('new_only', 'Yeni ilan', 'Yalnızca yeni ilan keşfi', Icons.rocket_launch_outlined),
    ('sweep_only', 'Temizlik', 'Yalnızca satılmış/kalkmış ilan temizliği', Icons.cleaning_services_outlined),
  ];

  Future<void> _send(String action, {String? mode, String? confirm}) async {
    if (_busy) return;
    if (confirm != null) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Emin misin?'),
          content: Text(confirm),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Vazgeç')),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Evet')),
          ],
        ),
      );
      if (ok != true || !mounted) return;
    }
    HapticFeedback.mediumImpact();
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final message = await _api.daemonControl(action, mode: mode);
      messenger.showSnackBar(SnackBar(content: Text(message)));
      await widget.onChanged();
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final command = widget.daemon['command']?.toString() ?? 'run';
    final mode = widget.daemon['mode']?.toString() ?? 'hybrid';
    final stopped = command == 'stop';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('MOTOR KONTROLÜ', style: AppText.eyebrow(context)),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: stopped
                      ? FilledButton.icon(
                          onPressed: _busy ? null : () => _send('start'),
                          icon: const Icon(Icons.play_arrow_rounded, size: 20),
                          label: const Text('Motoru başlat'),
                        )
                      : OutlinedButton.icon(
                          onPressed: _busy
                              ? null
                              : () => _send('stop', confirm: 'Motor durdurulursa kurumsal kaynak taraması ve otomatik bakım yeniden başlatılana kadar çalışmaz.'),
                          icon: Icon(Icons.stop_rounded, size: 20, color: c.pricey),
                          label: Text('Durdur', style: TextStyle(color: c.pricey)),
                        ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy
                        ? null
                        : () => _send('restart', confirm: 'Motor yeniden başlatılır ve GitHub\'dan en güncel kodu çeker (birkaç dakika sürer).'),
                    icon: const Icon(Icons.restart_alt_rounded, size: 20),
                    label: const Text('Yeniden başlat'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text('ÇALIŞMA MODU', style: AppText.eyebrow(context)),
            const SizedBox(height: 8),
            for (final (key, label, note, icon) in _modes)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: _busy || mode == key ? null : () => _send('set_mode', mode: key),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: mode == key ? AppTheme.accent : c.border, width: mode == key ? 1.5 : 1),
                      color: mode == key ? AppTheme.accent.withValues(alpha: 0.08) : null,
                    ),
                    child: Row(
                      children: [
                        Icon(icon, size: 20, color: mode == key ? AppTheme.accent : c.muted),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                              Text(note, style: TextStyle(fontSize: 11.5, color: c.muted)),
                            ],
                          ),
                        ),
                        if (mode == key) const Icon(Icons.check_circle, size: 18, color: AppTheme.accent),
                      ],
                    ),
                  ),
                ),
              ),
            if (_busy) const Padding(padding: EdgeInsets.only(top: 6), child: LinearProgressIndicator(minHeight: 2)),
          ],
        ),
      ),
    );
  }
}
