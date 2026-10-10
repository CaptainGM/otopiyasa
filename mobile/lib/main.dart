import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:otopiyasa/screens/favorites_screen.dart';
import 'package:otopiyasa/widgets/listing_image.dart';
import 'package:otopiyasa/screens/offers_screen.dart';
import 'package:otopiyasa/screens/my_listings_screen.dart';
import 'package:otopiyasa/screens/notifications_screen.dart';
import 'package:otopiyasa/screens/profile_screen.dart';
import 'package:otopiyasa/screens/predict_screen.dart';
import 'package:otopiyasa/screens/assistant_screen.dart';
import 'package:otopiyasa/screens/sell_screen.dart';
import 'package:otopiyasa/screens/map_screen.dart';
import 'package:otopiyasa/screens/compare_screen.dart';
import 'package:otopiyasa/screens/analytics_screen.dart';
import 'package:otopiyasa/screens/nearby_screen.dart';
import 'package:otopiyasa/screens/main_shell.dart';
import 'package:otopiyasa/screens/login_screen.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/data_saver.dart';
import 'package:otopiyasa/services/notification_service.dart';
import 'package:otopiyasa/services/push_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/utils/deep_link.dart';

/// Bildirime dokunulduğunda (FCM ya da yerel yoklama) ilanı açabilmek için:
/// servisler Navigator'a doğrudan erişemez, bu anahtar üzerinden gidilir.
final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();

/// Aynı ilanın çok kısa süre içinde iki kez açılmasını engeller.
///
/// İki ayrı yol aynı dokunuşu bildirebiliyor: FCM'in `onMessageOpenedApp` akışı ile
/// `getInitialMessage()` (uygulama tamamen kapalıyken açılan bildirim) aynı mesajı verebilir;
/// ayrıca yerel bildirimin dokunma geri çağrısı uygulama öne gelirken tekrar tetiklenebilir.
/// Bu olmadan kullanıcı aynı ilanı üst üste iki kez açılmış görüyordu.
final Map<String, int> _recentlyOpened = {};
const _duplicateOpenWindowMs = 2000;

/// İlan detayını açar (aynı ilan kısa süre içinde tekrar istenirse yok sayılır).
void _openCar(String carId) {
  final navigator = _navigatorKey.currentState;
  if (navigator == null) return;
  final now = DateTime.now().millisecondsSinceEpoch;
  final last = _recentlyOpened[carId];
  if (last != null && now - last < _duplicateOpenWindowMs) return;
  _recentlyOpened[carId] = now;
  // Sözlük sınırsız büyümesin: yalnızca son 32 ilan izlenir.
  if (_recentlyOpened.length > 32) {
    final oldest = _recentlyOpened.entries.reduce((a, b) => a.value <= b.value ? a : b);
    _recentlyOpened.remove(oldest.key);
  }
  navigator.push(MaterialPageRoute(builder: (_) => DetailScreen(carId: carId)));
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Optimize image cache for smooth list scrolling and avoid re-downloading images
  PaintingBinding.instance.imageCache.maximumSizeBytes = 256 << 20; // 256 MB
  PaintingBinding.instance.imageCache.maximumSize = 2000; // 2000 images
  // These are local-only setup tasks. Do them before first paint, but keep all
  // network and notification work out of the critical startup path.
  await Future.wait([
    initializeDateFormatting('tr_TR'),
    themeController.load(),
    DataSaver.instance.init(),
  ]);
  runApp(const OtoPiyasaApp());
  unawaited(_initializeSessionAndNotifications());
  unawaited(trimListingImageCache());
}

Future<void> _initializeSessionAndNotifications() async {
  try {
    await ApiService().restoreSession();
  } catch (error) {
    // Secure storage or network failure must not keep the app from opening.
    debugPrint('Oturum geri yüklenemedi: $error');
  }
  // Bildirimler oturum açıkken başlar: uygulama açılışında ya da sonradan giriş yapılınca. Eskiden yalnızca açılışta
  // bakılıyordu; çıkışlı açılıp sonra giriş yapan telefon, uygulama yeniden başlatılana kadar push jetonu kaydetmiyordu.
  ApiService().authRevision.addListener(() {
    if (ApiService().isLoggedIn) unawaited(_startNotifications());
  });
  if (ApiService().isLoggedIn) await _startNotifications();
}

Future<void> _startNotifications() async {
  try {
    await NotificationService.instance.init();
    // Yoklama kanalıyla gelen bildirime dokunmak da ilanı açsın.
    NotificationService.instance.onOpenCar = _openCar;
    NotificationService.instance.startPolling();
  } catch (error) {
    debugPrint('Bildirimler başlatılamadı: $error');
  }

  try {
    await PushService.instance.init();
    // FCM kanalı: uygulama açıkken/arkada plandayken gelen bildirime dokunma.
    PushService.instance.onOpenCar = _openCar;
    // Uygulama tamamen kapalıyken gelen bildirime dokunulup açıldıysa ilan kimliği
    // init sırasında saklanmıştı; burada açılır.
    final pending = PushService.instance.consumePendingCarId();
    if (pending != null) _openCar(pending);
  } catch (error) {
    debugPrint('Push bildirimleri başlatılamadı: $error');
  }
}

class OtoPiyasaApp extends StatelessWidget {
  const OtoPiyasaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeController,
      builder: (context, mode, _) => MaterialApp(
        title: 'OtoPiyasa',
        debugShowCheckedModeBanner: false,
        navigatorKey: _navigatorKey,
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: mode,
        home: const MainShell(),
                onGenerateRoute: (settings) {
          // https://otopiyasa.app/cars/<id> ve otopiyasa://cars/<id> biçimlerinin ikisi de
          // utils/deep_link.dart içinde çözülür (bildirim dokunuşu da aynı fonksiyonu kullanır).
          final carId = carIdFromDeepLink(settings.name);
          if (carId != null) {
            return MaterialPageRoute(
              builder: (_) => DetailScreen(carId: carId),
              settings: settings,
            );
          }
          return null;
        },
        routes: {
          '/login': (_) => const LoginScreen(),
          '/favorites': (_) => const FavoritesScreen(),
          '/offers': (_) => const OffersScreen(),
          '/listings': (_) => const MyListingsScreen(),
          '/sell': (_) => const SellScreen(),
          '/notifications': (_) => const NotificationsScreen(),
          '/profile': (_) => const ProfileScreen(),
          '/predict': (_) => const PredictScreen(),
          '/assistant': (_) => const AssistantScreen(),
          '/map': (_) => const MapScreen(),
          '/nearby': (_) => const NearbyScreen(),
          '/compare': (_) => const CompareScreen(),
          '/analytics': (_) => const AnalyticsScreen(),
        },
      ),
    );
  }
}
