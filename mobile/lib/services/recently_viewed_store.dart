import 'package:shared_preferences/shared_preferences.dart';

/// Son bakılan ilan kimlikleri — web'deki localStorage tabanlı
/// recently-viewed-store.ts ile aynı desen, burada shared_preferences.
class RecentlyViewedStore {
  static const _key = 'otopiyasa:recently-viewed';
  static const _maxItems = 12;

  static Future<void> record(String carId) async {
    final prefs = await SharedPreferences.getInstance();
    final ids = prefs.getStringList(_key) ?? [];
    ids.remove(carId);
    ids.insert(0, carId);
    await prefs.setStringList(_key, ids.take(_maxItems).toList());
  }

  static Future<List<String>> list() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(_key) ?? [];
  }
}
