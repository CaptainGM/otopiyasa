import 'dart:async';
import 'package:flutter/widgets.dart';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// BİLDİRİM SERVİSİ.
///
/// KAPSAM: Uygulama AÇIKKEN ya da arka plandayken sunucu düzenli aralıkla yoklanır ve
/// yeni okunmamış bildirim varsa telefonda bildirim gösterilir. Uygulama TAMAMEN
/// KAPALIYKEN bildirim [PushService] (FCM) tarafından getirilir; iki kanal da aynı
/// yerel bildirim kanalını kullanır.
///
/// Bu yaklaşım pil dostu olsun diye 60 saniyede bir yokluyor. Telefonda gösterilen son
/// bildirimin kimliği cihazda saklanır; yalnızca ondan sonra gelenler gösterilir. Eskiden
/// sayaç yalnızca bellekteydi ve uygulama her açıldığında son okunmamış bildirim yeniden düşüyordu.
class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final _plugin = FlutterLocalNotificationsPlugin();
  final _api = ApiService();

  Timer? _timer;
  bool _ready = false;
  static const _shownKey = 'last_shown_notification_id';
  String? _lastShownId;

  /// Bildirime dokunulduğunda ilgili ilanı açmak için main.dart tarafından bağlanır.
  void Function(String carId)? onOpenCar;

  /// Yeni okunmamış bildirim sayısı değiştiğinde tetiklenir (rozet için).
  final unreadStream = StreamController<int>.broadcast();

  Future<void> init() async {
    if (_ready) return;
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(android: android);
    // Bildirime dokunulduğunda çalışır. İlan kimliği bildirim yükünde taşınır.
    await _plugin.initialize(settings, onDidReceiveNotificationResponse: _onTap);

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
    _lastShownId = null;
  }

  Future<void> _check() async {
    if (!_api.isLoggedIn) return;
    // Arka planda yoklama yapılmaz (anlık bildirimleri FCM getirir); uygulamaya dönülünce zamanlayıcı devam eder.
    if (WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed) return;
    try {
      final items = await _api.fetchNotifications();
      final unread = items.where((n) => !n.read).toList();
      unreadStream.add(unread.length);

      if (unread.isEmpty) return;
      final prefs = await SharedPreferences.getInstance();
      _lastShownId ??= prefs.getString(_shownKey);
      final latest = unread.first;
      if (latest.id == _lastShownId) return;
      // İlk kurulumda (hiç kayıt yokken) birikmiş eski bildirimler telefona düşürülmez.
      if (_lastShownId != null) await _show(latest.title, latest.body);
      _lastShownId = latest.id;
      await prefs.setString(_shownKey, latest.id);
    } catch (_) {
      // Ağ hatası sessizce geçilir; bir sonraki yoklamada tekrar denenir.
    }
  }

  Future<void> _show(String title, String body, {String? carId}) async {
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
    await _plugin.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      details,
      // Dokunulduğunda hangi ilanın açılacağını taşır (aşağıdaki _onTap okur).
      payload: carId,
    );
  }

  void _onTap(NotificationResponse response) {
    final carId = response.payload;
    if (carId == null || carId.isEmpty) return;
    onOpenCar?.call(carId);
  }

  /// PushService'in (FCM ön plan mesajları) aynı bildirim kanalını kullanması
  /// için dışa açık — iki ayrı bildirim gösterim yolu olmasın diye.
  Future<void> showRaw(String title, String body, {String? carId}) => _show(title, body, carId: carId);
}
