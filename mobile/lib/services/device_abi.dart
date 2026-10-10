/// Cihazın hangi işlemci mimarisini kullandığını söyler (bkz.
/// mobile/android/app/src/main/kotlin/.../MainActivity.kt).
///
/// Yayın mimariye göre bölünmüş paketler içerdiği için (/api/app-version'a `abi` parametresi
/// gönderilir) otomatik güncellemenin ~65 MB'lık evrensel paket yerine cihaza uyan ~23 MB'lık
/// paketi indirmesini sağlar.
///
/// Saf yardımcı, testten doğrudan çağrılabilir: hangi değerin hangi pakete denk geldiğini
/// burada tutmak, sunucudaki dosya adı kuralıyla tek yerde buluşmasını sağlar.
library;

import 'dart:io';

import 'package:flutter/services.dart';

/// Sunucudaki paket adlarıyla eşleşen desteklenen mimariler.
const supportedAbis = <String>['arm64-v8a', 'armeabi-v7a'];

/// Android'in `Build.SUPPORTED_ABIS` listesinden (öncelik sırasına göre) bize uyanı seçer.
/// Eşleşme yoksa null: sunucu evrensel paketi verir.
String? pickAbi(List<String>? supported) {
  if (supported == null) return null;
  for (final abi in supported) {
    if (supportedAbis.contains(abi)) return abi;
  }
  return null;
}

const MethodChannel _channel = MethodChannel('otopiyasa/device');

String? _cachedAbi;
bool _looked = false;

/// Cihazın mimarisi; yalnızca Android'de ve yalnızca bir kez sorulur.
/// Kanal yoksa/başarısız olursa null döner (güncelleme evrensel paketle yapılır).
Future<String?> deviceAbi() async {
  if (!Platform.isAndroid) return null;
  if (_looked) return _cachedAbi;
  _looked = true;
  try {
    final abi = await _channel.invokeMethod<String>('preferredAbi');
    _cachedAbi = pickAbi(abi == null ? null : [abi]);
  } catch (_) {
    // Kanal kurulmamış (ör. test/emülatör) ya da native taraf hata verdi: evrensel pakete düşülür.
    _cachedAbi = null;
  }
  return _cachedAbi;
}

/// Testler için önbelleği sıfırlar.
void resetDeviceAbiCache() {
  _cachedAbi = null;
  _looked = false;
}
