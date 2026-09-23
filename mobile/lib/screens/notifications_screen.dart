import 'package:flutter/material.dart';
import 'package:otopiyasa/models/account.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/screens/offer_thread_screen.dart';
import 'package:otopiyasa/services/api_service.dart';

/// BİLDİRİMLER — web'deki zil simgesinin mobil karşılığı.
///
/// Ekran açıldığında hepsi okundu işaretlenir (web de böyle yapıyor).
/// Bildirimin `link` alanı web yolu ("/offers/123", "/cars/456") olduğu için
/// mobilde ilgili ekrana çevriliyor.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _api = ApiService();
  late Future<List<AppNotification>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<AppNotification>> _load() async {
    final items = await _api.fetchNotifications();
    // Görüldü say: rozet sıfırlansın.
    _api.markNotificationsRead().catchError((_) {});
    return items;
  }

  /// "/offers/123" → teklif kanalı, "/cars/456" veya "http.../cars/456" → ilan detayı.
  void _open(AppNotification n) {
    if (n.link.isEmpty) return;
    Uri? uri;
    try {
      uri = Uri.parse(n.link);
    } catch (_) {}

    final path = (uri != null && uri.path.isNotEmpty) ? uri.path : n.link;
    final parts = path.split('/').where((p) => p.isNotEmpty).toList();
    final carIdx = parts.indexOf('cars');
    final offerIdx = parts.indexOf('offers');

    if (offerIdx != -1 && offerIdx + 1 < parts.length) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => OfferThreadScreen(offerId: parts[offerIdx + 1])),
      );
    } else if (carIdx != -1 && carIdx + 1 < parts.length) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => DetailScreen(carId: parts[carIdx + 1])),
      );
    }
  }

  IconData _iconFor(String type) => switch (type) {
        'offer' => Icons.local_offer_outlined,
        'question' => Icons.help_outline,
        'business' => Icons.storefront_outlined,
        _ => Icons.campaign_outlined,
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bildirimler')),
      body: RefreshIndicator(
        onRefresh: () async => setState(() => _future = _load()),
        child: FutureBuilder<List<AppNotification>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return _scrollable(snapshot.error.toString().replaceFirst('Exception: ', ''));
            }
            final items = snapshot.data ?? [];
            if (items.isEmpty) return _scrollable('Henüz bildirimin yok.');

            return ListView.separated(
              itemCount: items.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final n = items[i];
                return ListTile(
                  leading: Icon(_iconFor(n.type),
                      color: n.read ? Colors.white38 : Theme.of(context).colorScheme.primary),
                  title: Text(
                    n.title,
                    style: TextStyle(fontWeight: n.read ? FontWeight.normal : FontWeight.bold),
                  ),
                  subtitle: n.body.isEmpty ? null : Text(n.body),
                  onTap: n.link.isEmpty ? null : () => _open(n),
                );
              },
            );
          },
        ),
      ),
    );
  }

  Widget _scrollable(String text) => ListView(
        children: [
          Padding(
            padding: const EdgeInsets.all(32),
            child: Text(text, textAlign: TextAlign.center),
          ),
        ],
      );
}
