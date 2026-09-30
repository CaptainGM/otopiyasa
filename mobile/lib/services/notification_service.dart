import 'dart:async';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:otopiyasa/services/api_service.dart';

/// BİLDİRİM SERVİSİ.
///
/// KAPSAM VE SINIRI (dürüst olmak gerekirse):
/// Uygulama AÇIKKEN ya da arka plandayken sunucu düzenli aralıkla yoklanır ve
/// yeni okunmamış bildirim varsa telefonda bildirim gösterilir. Uygulama
/// TAMAMEN KAPALIYKEN bildirim için Firebase Cloud Messaging (FCM) gerekir —
/// kodu [PushService]'de hazır (bkz. push_service.dart üstündeki kurulum
/// notu), ama ayrı bir Firebase projesi + `google-services.json` + sunucuda
/// FCM anahtarı gibi Google hesabı gerektiren adımlar tamamlanana kadar
/// devre dışı kalır. O tamamlanana kadar bu yoklama yöntemi tek kanal.
///
/// Bu yaklaşım pil dostu olsun diye 60 saniyede bir yokluyor ve yalnızca
/// SAYI ARTTIĞINDA bildirim çıkarıyor (aynı bildirimi tekrar göstermiyor).
class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final _plugin = FlutterLocalNotificationsPlugin();
  final _api = ApiService();

  Timer? _timer;
  int _lastUnreadCount = 0;
  bool _ready = false;

  /// Yeni okunmamış bildirim sayısı değiştiğinde tetiklenir (rozet için).
  final unreadStream = StreamController<int>.broadcast();

  Future<void> init() async {
    if (_ready) return;
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(android: android);
    await _plugin.initialize(settings);

    // Android 13+ bildirim izni çalışma anında istenir.
    await _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();

    _ready = true;
  }

  /// Girişten sonra çağrılır; çıkışta [stop] ile durdurulur.
  void startPolling() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 60), (_) => _check());
    _check();
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    _lastUnreadCount = 0;
  }

  Future<void> _check() async {
    if (!_api.isLoggedIn) return;
    try {
      final items = await _api.fetchNotifications();
      final unread = items.where((n) => !n.read).toList();
      unreadStream.add(unread.length);

      // Yalnızca ARTIŞ olduğunda bildir; aksi halde her yoklamada tekrar eder.
      if (unread.length > _lastUnreadCount && unread.isNotEmpty) {
        final latest = unread.first;
        await _show(latest.title, latest.body);
      }
      _lastUnreadCount = unread.length;
    } catch (_) {
      // Ağ hatası sessizce geçilir; bir sonraki yoklamada tekrar denenir.
    }
  }

  Future<void> _show(String title, String body) async {
    if (!_ready) await init();
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'otopiyasa_general',
        'OtoPiyasa bildirimleri',
        channelDescription: 'Teklif, soru ve ilan durumu bildirimleri',
        importance: Importance.high,
        priority: Priority.high,
      ),
    );
    await _plugin.show(DateTime.now().millisecondsSinceEpoch ~/ 1000, title, body, details);
  }

  /// PushService'in (FCM ön plan mesajları) aynı bildirim kanalını kullanması
  /// için dışa açık — iki ayrı bildirim gösterim yolu olmasın diye.
  Future<void> showRaw(String title, String body) => _show(title, body);
}
