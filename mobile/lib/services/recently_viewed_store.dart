import 'package:flutter/foundation.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Son bakılan ilan kimlikleri, HESAP BAŞINA tutulur (web'deki recently-viewed-store.ts ile aynı kural):
/// aynı telefonda hesap değişince önceki hesabın listesi görünmez; oturum yoksa "guest" listesi kullanılır.
class RecentlyViewedStore {
  /// Eski, hesapsız anahtar. Hesaplar arasında karışıyordu; ilk okuma ya da yazmada silinir.
  static const _legacyKey = 'otopiyasa:recently-viewed';
  static const _keyPrefix = 'otopiyasa:recently-viewed:';
  static const _maxItems = 12;

  /// Her kayıtta artar; açık ekranlar (ana sayfadaki şerit) listeyi yeniden okur.
  static final changes = ValueNotifier<int>(0);

  /// Anahtar await'ten ÖNCE alınır: görüntüleme, o an bakan hesabın listesine düşer.
  static Future<void> record(String carId) async {
    final key = _key();
    final prefs = await SharedPreferences.getInstance();
    await _purgeLegacy(prefs);
    final ids = prefs.getStringList(key) ?? [];
    ids.remove(carId);
    ids.insert(0, carId);
    await prefs.setStringList(key, ids.take(_maxItems).toList());
    changes.value++;
  }

  /// Oturumdaki hesabın geçmişini siler (yalnızca bu hesabın anahtarı; diğer hesaplara dokunulmaz).
  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await _purgeLegacy(prefs);
    await prefs.remove(_key());
    changes.value++;
  }

  static Future<List<String>> list() async {
    final prefs = await SharedPreferences.getInstance();
    await _purgeLegacy(prefs);
    return prefs.getStringList(_key()) ?? [];
  }

  /// Oturumdaki hesabın anahtarı; oturum yoksa misafir listesi.
  static String _key() {
    final id = ApiService().currentUser?['_id']?.toString();
    return '$_keyPrefix${id == null || id.isEmpty ? 'guest' : id}';
  }

  static Future<void> _purgeLegacy(SharedPreferences prefs) async {
    if (prefs.containsKey(_legacyKey)) await prefs.remove(_legacyKey);
  }
}
