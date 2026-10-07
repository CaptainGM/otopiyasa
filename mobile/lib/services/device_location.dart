import 'dart:async';
import 'dart:io';

import 'package:geolocator/geolocator.dart';

/// Cihazın konumu (yakınımdaki ilanlar, haritada "Konumum"). İzin ister; hata mesajları kullanıcıya gösterilir.
///
/// Kapalı alanda/emülatörde taze konum gelmeyebilir; zaman sınırı yokken ekran sonsuza dek yükleniyordu. Mesafe
/// zaten ilçe düzeyinde yaklaşık, orta doğruluk yeter. Google "konum doğruluğu" penceresi reddedilirse (ağ konumu
/// kapalı) Google'ın konum servisi sonuç vermiyor; ikinci denemede Android'in GPS'i doğrudan kullanılır. Eski "son
/// bilinen konum" en son çaredir, çünkü başka bir şehirden kalmış olabilir.
Future<Position> currentDevicePosition() async {
  final serviceEnabled = await Geolocator.isLocationServiceEnabled();
  if (!serviceEnabled) {
    throw Exception('Konum servisleri kapalı. Cihaz ayarlarından konumu aç.');
  }
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied) {
      throw Exception('Konum izni verilmedi.');
    }
  }
  if (permission == LocationPermission.deniedForever) {
    throw Exception('Konum izni kalıcı reddedilmiş. Ayarlardan izin vermen gerekiyor.');
  }
  final attempts = <LocationSettings>[
    const LocationSettings(accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 8)),
    if (Platform.isAndroid)
      AndroidSettings(accuracy: LocationAccuracy.high, forceLocationManager: true, timeLimit: const Duration(seconds: 12))
    else
      const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 12)),
  ];
  for (final settings in attempts) {
    try {
      return await Geolocator.getCurrentPosition(locationSettings: settings);
    } on TimeoutException {
      continue;
    } on LocationServiceDisabledException {
      continue;
    }
  }
  final last = await Geolocator.getLastKnownPosition();
  if (last != null) return last;
  throw Exception('Konum alınamadı. Konum servisinin açık olduğundan emin olup tekrar dene.');
}
