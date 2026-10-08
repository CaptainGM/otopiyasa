import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Web ile aynı tasarım dili (bkz. src/app/globals.css): grafit zemin, tek vurgu rengi (amber, yalnızca ana eylem),
/// fiyatın piyasadaki yerini anlatan üç veri rengi (ucuz = nane, adil = buz mavisi, pahalı = mercan).
/// Başlıklar geniş Archivo, fiyat ve rakamlar eş aralıklı IBM Plex Mono (pubspec.yaml fonts).
class AppTheme {
  // Marka rengi — iki temada da aynı kimlik.
  static const Color accent = Color(0xFFF2B544);
  static const Color accentInk = Color(0xFF1A1203);
  static const Color accent2 = Color(0xFF7DD3C0);

  // Koyu yüzeyler
  static const Color bg = Color(0xFF0B0C0E);
  static const Color bgSoft = Color(0xFF111317);
  static const Color card = Color(0xFF131519);
  static const Color text = Color(0xFFF2F1EC);

  // Açık yüzeyler
  static const Color bgLight = Color(0xFFF3F1EB);
  static const Color bgSoftLight = Color(0xFFEBE8E0);
  static const Color cardLight = Color(0xFFFFFFFF);
  static const Color textLight = Color(0xFF1C1A16);

  static const String display = 'Archivo';
  static const String mono = 'PlexMono';

  static ThemeData get dark => _build(Brightness.dark, AppColors.dark);
  static ThemeData get light => _build(Brightness.light, AppColors.light);

  static ThemeData _build(Brightness brightness, AppColors c) {
    final isDark = brightness == Brightness.dark;
    final base = isDark ? ThemeData.dark() : ThemeData.light();
    final textColor = isDark ? text : textLight;
    final radius = BorderRadius.circular(14);
    final smallRadius = BorderRadius.circular(10);

    final textTheme = base.textTheme
        .apply(bodyColor: textColor, displayColor: textColor)
        .copyWith(
          headlineLarge: TextStyle(fontFamily: display, fontWeight: FontWeight.w700, color: textColor, letterSpacing: -0.6),
          headlineMedium: TextStyle(fontFamily: display, fontWeight: FontWeight.w700, color: textColor, letterSpacing: -0.5),
          headlineSmall: TextStyle(fontFamily: display, fontWeight: FontWeight.w700, color: textColor, letterSpacing: -0.4),
          titleLarge: TextStyle(fontFamily: display, fontWeight: FontWeight.w600, fontSize: 20, color: textColor, letterSpacing: -0.3),
        );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: isDark ? bg : bgLight,
      extensions: [c],
      colorScheme: (isDark ? const ColorScheme.dark() : const ColorScheme.light()).copyWith(
        primary: accent,
        onPrimary: accentInk,
        secondary: isDark ? accent2 : const Color(0xFF157A63),
        surface: isDark ? card : cardLight,
        onSurface: textColor,
        surfaceContainerHighest: c.surface2,
        outline: c.borderStrong,
        outlineVariant: c.border,
        error: isDark ? const Color(0xFFF87171) : const Color(0xFFC8281F),
      ),
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: isDark ? bg : bgLight,
        foregroundColor: textColor,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(fontFamily: display, fontWeight: FontWeight.w600, fontSize: 19, color: textColor, letterSpacing: -0.3),
      ),
      cardTheme: CardThemeData(
        color: isDark ? card : cardLight,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: radius, side: BorderSide(color: c.border)),
      ),
      dividerTheme: DividerThemeData(color: c.border, thickness: 1, space: 1),
      navigationBarTheme: NavigationBarThemeData(
        height: 64,
        labelPadding: EdgeInsets.zero,
        backgroundColor: isDark ? bgSoft : cardLight,
        surfaceTintColor: Colors.transparent,
        indicatorColor: accent.withValues(alpha: isDark ? 0.16 : 0.22),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 10.5,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? textColor : c.muted,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(size: 23, color: states.contains(WidgetState.selected) ? (isDark ? accent : const Color(0xFF9A6A0C)) : c.muted),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: accentInk,
          disabledBackgroundColor: accent.withValues(alpha: 0.4),
          shape: RoundedRectangleBorder(borderRadius: smallRadius),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: textColor,
          side: BorderSide(color: c.borderStrong),
          shape: RoundedRectangleBorder(borderRadius: smallRadius),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: textColor,
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: smallRadius),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: Colors.transparent,
        selectedColor: textColor,
        disabledColor: Colors.transparent,
        side: BorderSide(color: c.border),
        shape: const StadiumBorder(),
        labelStyle: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.muted),
        secondaryLabelStyle: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: isDark ? accentInk : Colors.white),
        checkmarkColor: isDark ? accentInk : Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        showCheckmark: false,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark ? bgSoft : Colors.black.withValues(alpha: 0.025),
        hintStyle: TextStyle(color: c.faint),
        labelStyle: TextStyle(color: c.muted),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(borderRadius: smallRadius, borderSide: BorderSide(color: c.border)),
        enabledBorder: OutlineInputBorder(borderRadius: smallRadius, borderSide: BorderSide(color: c.border)),
        focusedBorder: OutlineInputBorder(borderRadius: smallRadius, borderSide: const BorderSide(color: accent, width: 1.4)),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: isDark ? bgSoft : cardLight,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: c.borderStrong,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: isDark ? const Color(0xFF1F2228) : textLight,
        contentTextStyle: TextStyle(color: isDark ? text : Colors.white),
        shape: RoundedRectangleBorder(borderRadius: smallRadius),
      ),
      listTileTheme: ListTileThemeData(iconColor: c.muted),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: accent),
    );
  }
}

/// Temaya göre değişen yardımcı renkler: `AppColors.of(context).muted` gibi kullanılır. Sabit `Colors.white54`
/// yerine bunlar kullanılınca açık temada da okunur kalır.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.muted,
    required this.faint,
    required this.border,
    required this.borderStrong,
    required this.surface2,
    required this.cheap,
    required this.fair,
    required this.pricey,
  });

  final Color muted;
  final Color faint;
  final Color border;
  final Color borderStrong;
  final Color surface2;
  final Color cheap;
  final Color fair;
  final Color pricey;

  static const dark = AppColors(
    muted: Color(0xFF8F8D86),
    faint: Color(0xFF5F5E59),
    border: Color(0x13FFFFFF),
    borderStrong: Color(0x29FFFFFF),
    surface2: Color(0xFF1A1D23),
    cheap: Color(0xFF34D399),
    fair: Color(0xFF7DD3FC),
    pricey: Color(0xFFFB7185),
  );

  static const light = AppColors(
    muted: Color(0xFF6C685F),
    faint: Color(0xFF9A958B),
    border: Color(0x1A1C1A16),
    borderStrong: Color(0x331C1A16),
    surface2: Color(0xFFF6F4EE),
    cheap: Color(0xFF0F9D63),
    fair: Color(0xFF0B78B5),
    pricey: Color(0xFFD6334F),
  );

  static AppColors of(BuildContext context) => Theme.of(context).extension<AppColors>() ?? dark;

  @override
  AppColors copyWith({
    Color? muted,
    Color? faint,
    Color? border,
    Color? borderStrong,
    Color? surface2,
    Color? cheap,
    Color? fair,
    Color? pricey,
  }) =>
      AppColors(
        muted: muted ?? this.muted,
        faint: faint ?? this.faint,
        border: border ?? this.border,
        borderStrong: borderStrong ?? this.borderStrong,
        surface2: surface2 ?? this.surface2,
        cheap: cheap ?? this.cheap,
        fair: fair ?? this.fair,
        pricey: pricey ?? this.pricey,
      );

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      muted: Color.lerp(muted, other.muted, t)!,
      faint: Color.lerp(faint, other.faint, t)!,
      border: Color.lerp(border, other.border, t)!,
      borderStrong: Color.lerp(borderStrong, other.borderStrong, t)!,
      surface2: Color.lerp(surface2, other.surface2, t)!,
      cheap: Color.lerp(cheap, other.cheap, t)!,
      fair: Color.lerp(fair, other.fair, t)!,
      pricey: Color.lerp(pricey, other.pricey, t)!,
    );
  }
}

/// Yazı yardımcıları: fiyat/rakam (eş aralıklı) ve küçük büyük harfli üst etiket ("2021 / İSTANBUL").
class AppText {
  static TextStyle num({double size = 14, FontWeight weight = FontWeight.w500, Color? color}) => TextStyle(
        fontFamily: AppTheme.mono,
        fontSize: size,
        fontWeight: weight,
        color: color,
        letterSpacing: -0.2,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  static TextStyle eyebrow(BuildContext context, {Color? color, double size = 10.5}) => TextStyle(
        fontFamily: AppTheme.mono,
        fontSize: size,
        fontWeight: FontWeight.w500,
        letterSpacing: 1.3,
        color: color ?? AppColors.of(context).muted,
      );

  static TextStyle display({double size = 18, FontWeight weight = FontWeight.w600, Color? color}) => TextStyle(
        fontFamily: AppTheme.display,
        fontSize: size,
        fontWeight: weight,
        color: color,
        letterSpacing: -0.3,
        height: 1.15,
      );
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
