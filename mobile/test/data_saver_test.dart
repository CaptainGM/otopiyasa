import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/services/data_saver.dart';

void main() {
  group('shouldUseLowData', () {
    test('otomatik kip yalnızca hücresel veride tasarruf eder', () {
      expect(shouldUseLowData(DataSaverMode.auto, [ConnectivityResult.mobile]), isTrue);
      expect(shouldUseLowData(DataSaverMode.auto, [ConnectivityResult.wifi]), isFalse);
      expect(shouldUseLowData(DataSaverMode.auto, [ConnectivityResult.ethernet]), isFalse);
      // Wi-Fi ile hücresel birlikteyse (geçiş anı) Wi-Fi sayılır.
      expect(shouldUseLowData(DataSaverMode.auto, [ConnectivityResult.mobile, ConnectivityResult.wifi]), isFalse);
      expect(shouldUseLowData(DataSaverMode.auto, [ConnectivityResult.none]), isFalse);
      expect(shouldUseLowData(DataSaverMode.auto, const []), isFalse);
    });

    test('açık kip her zaman, kapalı kip hiçbir zaman tasarruf eder', () {
      expect(shouldUseLowData(DataSaverMode.on, [ConnectivityResult.wifi]), isTrue);
      expect(shouldUseLowData(DataSaverMode.off, [ConnectivityResult.mobile]), isFalse);
    });
  });
}
