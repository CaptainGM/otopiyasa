import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:otopiyasa/screens/favorites_screen.dart';
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
import 'package:otopiyasa/screens/home_screen.dart';
import 'package:otopiyasa/screens/login_screen.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/notification_service.dart';
import 'package:otopiyasa/services/push_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // tr_TR tarih biçimleri (fiyat geçmişi grafiği) için gerekli
  await initializeDateFormatting('tr_TR');
  // Kayıtlı oturumu geri yükle; sunucuya ulaşılamazsa sessizce devam eder
  await ApiService().restoreSession();
  // Bildirim kanalını hazırla; oturum varsa yoklamayı başlat.
  await NotificationService.instance.init();
  if (ApiService().isLoggedIn) NotificationService.instance.startPolling();
  // FCM (uygulama kapalıyken bildirim) — native kurulum tamamlanana kadar
  // sessizce devre dışı kalır, bkz. push_service.dart üstündeki not.
  await PushService.instance.init();
  // Kayıtlı açık/koyu tema tercihi — web'deki localStorage'a karşılık.
  await themeController.load();
  runApp(const OtoPiyasaApp());
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
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: mode,
        home: const HomeScreen(),
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
