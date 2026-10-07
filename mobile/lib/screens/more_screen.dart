import 'package:flutter/material.dart';
import 'package:otopiyasa/screens/admin_screen.dart';
import 'package:otopiyasa/screens/assistant_screen.dart';
import 'package:otopiyasa/screens/compare_screen.dart';
import 'package:otopiyasa/screens/favorites_screen.dart';
import 'package:otopiyasa/screens/my_listings_screen.dart';
import 'package:otopiyasa/screens/nearby_screen.dart';
import 'package:otopiyasa/screens/notifications_screen.dart';
import 'package:otopiyasa/screens/offers_screen.dart';
import 'package:otopiyasa/screens/profile_screen.dart';
import 'package:otopiyasa/screens/sell_screen.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/data_saver.dart';
import 'package:otopiyasa/services/notification_service.dart';
import 'package:otopiyasa/services/update_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/utils/tr_text.dart';
import 'package:otopiyasa/widgets/data_saver_dialog.dart';

/// "Hesap" sekmesi: eskiden ana sayfadaki hesap menüsüydü ve giriş yapmamış kullanıcıyı doğrudan giriş ekranına
/// atıyordu; harita, analiz, karşılaştırma ve yakınımdaki ilanlara girişsiz ulaşılamıyordu. Artık araçlar herkese
/// açık, hesaba bağlı bölümler (favoriler, teklifler, ilanlarım) giriş yapınca görünür.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  static final _api = ApiService();

  void _push(BuildContext context, Widget screen) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));

  Future<void> _logout(BuildContext context) async {
    await _api.logout();
    NotificationService.instance.stop();
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Çıkış yapıldı')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Hesap')),
      body: ValueListenableBuilder<int>(
        valueListenable: _api.authRevision,
        builder: (context, _, _) {
          final loggedIn = _api.isLoggedIn;
          final name = (_api.currentUser?['name'] as String?)?.trim() ?? '';
          final email = _api.currentUser?['email'] as String? ?? '';
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              if (loggedIn)
                _Panel(
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    leading: CircleAvatar(
                      backgroundColor: AppTheme.accent.withValues(alpha: 0.18),
                      child: Text(
                        name.isNotEmpty ? trUpper(name[0]) : '?',
                        style: const TextStyle(color: AppTheme.accent, fontWeight: FontWeight.w700),
                      ),
                    ),
                    title: Text(name.isNotEmpty ? name : 'Hesabım', style: AppText.display(size: 16)),
                    subtitle: Text(email, style: TextStyle(color: c.muted, fontSize: 12.5)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _push(context, const ProfileScreen()),
                  ),
                )
              else
                _Panel(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Giriş yap', style: AppText.display(size: 18)),
                        const SizedBox(height: 4),
                        Text(
                          'Favoriler, fiyat düşünce bildirim, teklif ve kendi ilanların için.',
                          style: TextStyle(color: c.muted, fontSize: 13, height: 1.35),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: () => Navigator.of(context).pushNamed('/login'),
                            child: const Text('Giriş yap / Kayıt ol'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              if (loggedIn) ...[
                _Section('İlanlar'),
                _Panel(
                  child: Column(children: [
                    _Row(icon: Icons.favorite_outline, title: 'Favorilerim', onTap: () => _push(context, const FavoritesScreen())),
                    _Row(icon: Icons.local_offer_outlined, title: 'Tekliflerim', onTap: () => _push(context, const OffersScreen())),
                    _Row(icon: Icons.list_alt, title: 'İlanlarım', onTap: () => _push(context, const MyListingsScreen())),
                    _Row(icon: Icons.add_box_outlined, title: 'İlan ver', onTap: () => _push(context, const SellScreen()), last: true),
                  ]),
                ),
              ],
              _Section('Araçlar'),
              _Panel(
                child: Column(children: [
                  _Row(icon: Icons.near_me_outlined, title: 'Yakınımdaki ilanlar', onTap: () => _push(context, const NearbyScreen())),
                  _Row(icon: Icons.compare_arrows, title: 'Karşılaştır', onTap: () => _push(context, const CompareScreen())),
                  _Row(icon: Icons.auto_awesome_outlined, title: 'Asistan', onTap: () => _push(context, const AssistantScreen()), last: true),
                ]),
              ),
              if (loggedIn && _api.isAdmin) ...[
                _Section('Yönetim'),
                _Panel(
                  child: _Row(
                    icon: Icons.admin_panel_settings_outlined,
                    title: 'Yönetim ve sistem takibi',
                    onTap: () => _push(context, const AdminScreen()),
                    accent: true,
                    last: true,
                  ),
                ),
              ],
              _Section('Uygulama'),
              _Panel(
                child: Column(children: [
                  if (loggedIn)
                    _Row(icon: Icons.notifications_outlined, title: 'Bildirimler', onTap: () => _push(context, const NotificationsScreen())),
                  ValueListenableBuilder<DataSaverMode>(
                    valueListenable: DataSaver.instance.mode,
                    builder: (context, mode, _) => _Row(
                      icon: Icons.data_saver_on_outlined,
                      title: 'Veri tasarrufu',
                      subtitle: dataSaverLabel(mode),
                      onTap: () => showDataSaverDialog(context),
                    ),
                  ),
                  ValueListenableBuilder<ThemeMode>(
                    valueListenable: themeController,
                    builder: (context, mode, _) => _Row(
                      icon: mode == ThemeMode.dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                      title: mode == ThemeMode.dark ? 'Aydınlık tema' : 'Karanlık tema',
                      onTap: themeController.toggle,
                    ),
                  ),
                  FutureBuilder(
                    future: UpdateService.packageInfo(),
                    builder: (context, snapshot) => _Row(
                      icon: Icons.system_update_outlined,
                      title: 'Güncellemeleri denetle',
                      subtitle: snapshot.hasData ? 'Yüklü sürüm ${snapshot.data!.version}' : null,
                      onTap: () => UpdateService.checkUpdate(context, manual: true),
                      last: !loggedIn,
                    ),
                  ),
                  if (loggedIn)
                    _Row(icon: Icons.logout, title: 'Çıkış yap', onTap: () => _logout(context), danger: true, last: true),
                ]),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 22, 4, 8),
        child: Text(trUpper(text), style: AppText.eyebrow(context)),
      );
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Card(clipBehavior: Clip.antiAlias, child: child);
}

class _Row extends StatelessWidget {
  const _Row({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.last = false,
    this.danger = false,
    this.accent = false,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final bool last;
  final bool danger;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final color = danger ? c.pricey : (accent ? AppTheme.accent : null);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ListTile(
          leading: Icon(icon, color: color ?? c.muted, size: 22),
          title: Text(title, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5, color: color)),
          subtitle: subtitle == null ? null : Text(subtitle!, style: TextStyle(color: c.muted, fontSize: 12)),
          trailing: danger ? null : Icon(Icons.chevron_right, color: c.faint, size: 20),
          onTap: onTap,
        ),
        if (!last) Divider(indent: 56, color: c.border),
      ],
    );
  }
}
