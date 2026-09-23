

import 'dart:async';
import 'dart:developer' as developer;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/notification_service.dart';

/// FIREBASE CLOUD MESSAGING (FCM) — uygulama TAMAMEN KAPALIYKEN bildirim.
///
/// [NotificationService] (60sn yoklama) uygulama açık/arka plandayken zaten
/// çalışıyor; bunun tek eksiği uygulama tamamen öldürüldüğünde bildirim
/// gösterememesiydi. Bu dosya o boşluğu FCM ile kapatmak için hazırlandı
/// ANCAK devreye girmesi için native tarafta bir kerelik, Google hesabı
/// gerektiren kurulum eksik — o yüzden [init] her adımda try/catch ile
/// sarılı: yapılandırma yoksa sessizce hiçbir şey yapmaz, uygulama yoklama
/// yöntemiyle çalışmaya devam eder. Kod derlenir ve çalışır; sadece FCM
/// bildirim ULAŞTIRAMAZ ta ki aşağıdaki adımlar tamamlanana kadar.
///
/// KALAN KURULUM (Google hesabı gerektirir, elle yapılmalı):
///  1) https://console.firebase.google.com → yeni proje → Android uygulama
///     ekle, paket adı: `com.otopiyasa.otopiyasa` (bkz.
///     mobile/android/app/build.gradle.kts → applicationId).
///  2) İndirilen `google-services.json` dosyasını `mobile/android/app/`
///     içine koy.
///  3) `mobile/android/build.gradle.kts` (proje kökü) → plugins bloğuna:
///       id("com.google.gms.google-services") version "4.4.2" apply false
///     `mobile/android/app/build.gradle.kts` → plugins bloğuna:
///       id("com.google.gms.google-services")
///  4) Firebase Console → Proje ayarları → Hizmet hesapları → "Yeni özel
///     anahtar oluştur" ile bir JSON indir; onun İÇERİĞİNİ (tamamını, tek
///     satır) sunucu tarafında `FCM_SERVICE_ACCOUNT_JSON` ortam değişkenine
///     yapıştır (bkz. src/lib/fcm.ts, .env.example). Vercel'de env var olarak
///     eklenmeli.
///  5) `flutter build apk` yeniden derlenmeli (google-services.json artık var).
///
/// Bu adımlar tamamlanmadan önce 1-4 arası HİÇBİR ŞEY bu dosyayı bozmaz;
/// [init] sırasında oluşan hata yutulur.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  final _api = ApiService();
  bool _initialized = false;

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

      // Uygulama açıkken gelen FCM mesajını, yoklamanın kullandığı aynı yerel
      // bildirim kanalından göster (tutarlı görünüm).
      FirebaseMessaging.onMessage.listen((message) {
        final title = message.notification?.title;
        final body = message.notification?.body;
        if (title != null) {
          NotificationService.instance.showRaw(title, body ?? '');
        }
      });
    } catch (error) {
      // Native Firebase yapılandırması (google-services.json) yoksa buraya
      // düşer — beklenen durum, sessizce devam.
      developer.log('PushService devre dışı (Firebase yapılandırılmamış): $error');
    }
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
