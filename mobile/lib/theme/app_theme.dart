import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Web'deki gerçek marka paleti (bkz. src/app/globals.css :root / [data-theme="light"]) —
/// mobil eskiden alakasız bir camgöbeği/turuncu ("Canva gibi") paletle kalmıştı,
/// web ay geçen amber/grafit rebrand'ini hiç görmedi. Renkler o dosyadan birebir alındı.
class AppTheme {
  // Marka rengi — hem açık hem koyu temada aynı (amber), sabit bir kimlik.
  static const Color accent = Color(0xFFEEB95C);
  static const Color accent2 = Color(0xFF7DD3C0);

  // Koyu yüzeyler
  static const Color bg = Color(0xFF0A0B0D);
  static const Color bgSoft = Color(0xFF131519);
  static const Color card = Color(0xFF16181C);
  static const Color text = Color(0xFFF5F5F2);

  // Açık yüzeyler
  static const Color bgLight = Color(0xFFF5F2EC);
  static const Color bgSoftLight = Color(0xFFECE7DC);
  static const Color cardLight = Color(0xFFFFFFFF);
  static const Color textLight = Color(0xFF241A0D);

  static ThemeData get dark {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bg,
      colorScheme: const ColorScheme.dark(
        primary: accent,
        secondary: accent2,
        surface: card,
        onSurface: text,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: bg,
        foregroundColor: text,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.04),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
      ),
      textTheme: ThemeData.dark().textTheme.apply(bodyColor: text, displayColor: text),
      useMaterial3: true,
    );
  }

  static ThemeData get light {
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: bgLight,
      colorScheme: const ColorScheme.light(
        primary: Color(0xFFB9790F),
        secondary: Color(0xFF157A63),
        surface: cardLight,
        onSurface: textLight,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: bgLight,
        foregroundColor: textLight,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: cardLight,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: Colors.black.withValues(alpha: 0.08)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.black.withValues(alpha: 0.03),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Colors.black.withValues(alpha: 0.1)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Colors.black.withValues(alpha: 0.1)),
        ),
      ),
      textTheme: ThemeData.light().textTheme.apply(bodyColor: textLight, displayColor: textLight),
      useMaterial3: true,
    );
  }
}

/// Açık/koyu tema tercihi — web'deki localStorage'a karşılık burada
/// shared_preferences ile saklanır. Varsayılan koyu (uygulamanın her zamanki hâli).
class ThemeController extends ValueNotifier<ThemeMode> {
  ThemeController() : super(ThemeMode.dark);

  static const _prefsKey = 'otopiyasa:theme';

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_prefsKey);
    if (saved == 'light') value = ThemeMode.light;
  }

  Future<void> toggle() async {
    value = value == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, value == ThemeMode.light ? 'light' : 'dark');
  }
}

final themeController = ThemeController();
