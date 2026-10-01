import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Veri tasarrufu: açıkken fotoğraflar küçük boyutta indirilir (kartta ~10 KB, galeride ~90 KB).
///  - [auto]: yalnızca hücresel veride (Wi-Fi'da normal boyut),
///  - [on]: her zaman küçük,
///  - [off]: her zaman normal boyut.
enum DataSaverMode { auto, on, off }

/// Seçili kip ve bağlantı türüne göre küçük fotoğraf kullanılıp kullanılmayacağı.
/// Bağlantı bilinmiyorsa (liste boş) tasarruf yapılmaz.
bool shouldUseLowData(DataSaverMode mode, List<ConnectivityResult> connection) {
  switch (mode) {
    case DataSaverMode.on:
      return true;
    case DataSaverMode.off:
      return false;
    case DataSaverMode.auto:
      final mobile = connection.contains(ConnectivityResult.mobile);
      final fixed = connection.contains(ConnectivityResult.wifi) || connection.contains(ConnectivityResult.ethernet);
      return mobile && !fixed;
  }
}

class DataSaver {
  DataSaver._();
  static final DataSaver instance = DataSaver._();

  static const _prefsKey = 'otopiyasa:dataSaver';

  /// Kullanıcının seçimi (profil ekranından değişir).
  final ValueNotifier<DataSaverMode> mode = ValueNotifier(DataSaverMode.auto);

  /// Şu an küçük fotoğraf kullanılmalı mı; görseller adres kurarken bunu okur.
  final ValueNotifier<bool> lowData = ValueNotifier(false);

  List<ConnectivityResult> _connection = const [];
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  /// Kayıtlı seçimi okur ve bağlantı değişikliklerini dinler. Başarısız olursa tasarruf kapalı kalır.
  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_prefsKey);
      mode.value = DataSaverMode.values.firstWhere((m) => m.name == saved, orElse: () => DataSaverMode.auto);
      _connection = await Connectivity().checkConnectivity();
      _recompute();
      _subscription ??= Connectivity().onConnectivityChanged.listen((result) {
        _connection = result;
        _recompute();
      });
    } catch (_) {
      // Bağlantı türü okunamazsa normal boyutla devam edilir.
    }
  }

  Future<void> setMode(DataSaverMode next) async {
    mode.value = next;
    _recompute();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, next.name);
    } catch (_) {}
  }

  void _recompute() => lowData.value = shouldUseLowData(mode.value, _connection);
}
