

import 'dart:async';
import 'dart:developer' as developer;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/notification_service.dart';
import 'package:otopiyasa/utils/deep_link.dart';

/// FIREBASE CLOUD MESSAGING (FCM) — uygulama TAMAMEN KAPALIYKEN bildirim.
///
/// [NotificationService] (60sn yoklama) uygulama açık/arka plandayken zaten
/// çalışıyor; bunun tek eksiği uygulama tamamen öldürüldüğünde bildirim
/// gösterememesiydi. Bu dosya o boşluğu FCM ile kapatır.
///
/// Native yapılandırma tamamdır: `mobile/android/app/google-services.json`
/// depoda, `com.google.gms.google-services` eklentisi settings.gradle.kts ve
/// app/build.gradle.kts içinde uygulanıyor, sunucu tarafında `src/lib/fcm.ts`
/// ve `FCM_SERVICE_ACCOUNT_JSON` hazır. (Buradaki eski not "kurulum eksik"
/// diyordu; kurulum yapıldıktan sonra güncellenmemişti.)
///
/// [init] yine de her adımda try/catch ile sarılıdır: yapılandırma bir gün
/// eksik olursa sessizce devre dışı kalır ve yoklama yöntemi çalışmaya devam eder.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  final _api = ApiService();
  bool _initialized = false;

  /// Bildirime dokunulduğunda ilanı açmak için main.dart tarafından bağlanır.
  /// Servis Navigator'a doğrudan erişmediği için geri çağrı dışarıdan verilir.
  void Function(String carId)? onOpenCar;

  /// Uygulama tamamen kapalıyken gelen bildirime dokunulup açıldığında
  /// getInitialMessage ile gelen ilan; arayüz kurulunca işlenir.
  String? _pendingCarId;

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    try {
      await Firebase.initializeApp();
      // Firebase.initializeApp() BAŞARILI olduktan SONRA kaydedilmeli — aksi
      // halde henüz kurulmamış varsayılan Firebase app'i arar ve patlar.
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      final settings = await FirebaseMessaging.instance.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;

      await _registerToken();
      FirebaseMessaging.instance.onTokenRefresh.listen((_) => _registerToken());
      // Giriş yapılınca jeton bu hesaba (ve bu oturuma) kaydedilir; çıkışta cihaz jetonu silinir. Sunucu da
      // bildirimi yalnızca oturumu açık cihazlara gönderir: çıkış yapılan telefona yönetici/teklif bildirimi gelmez.
      _wasLoggedIn = _api.isLoggedIn;
      _api.authRevision.addListener(_onAuthChanged);

      // Uygulama açıkken gelen FCM mesajını, yoklamanın kullandığı aynı yerel
      // bildirim kanalından göster (tutarlı görünüm).
      FirebaseMessaging.onMessage.listen((message) {
        // Çıkış yapılmışsa (jeton silinmeden önce yola çıkmış bir mesaj) gösterilmez.
        if (!_api.isLoggedIn) return;
        final title = message.notification?.title;
        final body = message.notification?.body;
        if (title != null) {
          NotificationService.instance.showRaw(
            title,
            body ?? '',
            carId: carIdFromDeepLink(_linkOf(message)),
          );
        }
      });

      // Bildirime dokunma yolları. Üçü ayrı ayrı bağlanmazsa bildirim gelir ama
      // dokununca uygulama yalnızca açılır, ilana gitmez.
      FirebaseMessaging.onMessageOpenedApp.listen((message) => _openFromMessage(message));

      // Uygulama tamamen kapalıyken dokunulup açıldıysa: arayüz henüz kurulmadığı
      // için ilan kimliği saklanır, main.dart hazır olunca consumePendingCarId alır.
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) _pendingCarId = carIdFromDeepLink(_linkOf(initial));
    } catch (error) {
      // Native Firebase yapılandırması yoksa buraya düşer — beklenen durum, sessizce devam.
      developer.log('PushService devre dışı (Firebase yapılandırılmamış): $error');
    }
  }

  /// FCM mesajındaki ilan bağlantısı: önce veri alanı, sonra yedek anahtarlar.
  /// Sunucu `data.url` olarak tam adres gönderir (bkz. src/lib/web-push.ts); yalnızca
  /// kimlik gelirse de çözülebilsin diye bağlantıya çevrilir.
  String? _linkOf(RemoteMessage message) {
    final data = message.data;
    final raw = data['url'] ?? data['link'] ?? data['carId'];
    if (raw is! String || raw.isEmpty) return null;
    if (raw.contains('://')) return raw;
    return raw.startsWith('/') ? 'https://otopiyasa.app$raw' : 'https://otopiyasa.app/cars/$raw';
  }

  void _openFromMessage(RemoteMessage message) {
    final carId = carIdFromDeepLink(_linkOf(message));
    if (carId != null) onOpenCar?.call(carId);
  }

  /// Kapalıyken açılan bildirimin ilanı (bir kez döner).
  String? consumePendingCarId() {
    final id = _pendingCarId;
    _pendingCarId = null;
    return id;
  }

  bool _wasLoggedIn = false;

  void _onAuthChanged() {
    final loggedIn = _api.isLoggedIn;
    if (loggedIn && !_wasLoggedIn) {
      _registerToken();
    } else if (!loggedIn && _wasLoggedIn) {
      // Sunucuya ulaşılamasa bile (çevrimdışı çıkış) eski jeton geçersiz olsun.
      FirebaseMessaging.instance.deleteToken().catchError((_) {});
    }
    _wasLoggedIn = loggedIn;
  }

  Future<void> _registerToken() async {
    if (!_api.isLoggedIn) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _api.registerFcmToken(token);
    } catch (error) {
      developer.log('FCM token kaydedilemedi: $error');
    }
  }
}

/// FCM'in arka plan/kapalı-uygulama mesajları için üst düzey giriş noktası
/// olarak kaydedilmesi ZORUNLU (plugin bunu bekliyor), fiilen boş — bildirim
/// tipi mesajlarda işletim sistemi zaten kendi göstergesini çiziyor.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {}
