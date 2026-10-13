import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/services/update_service.dart';

void main() {
  group('isForceUpdateRequired', () {
    test('minVersionCode eşiğinin altındaki sürüm zorunlu güncellemeye girer', () {
      expect(
        isForceUpdateRequired(currentVersionCode: 6, data: {'minVersionCode': 7}),
        isTrue,
      );
    });

    test('eşiğe ulaşan ya da geçen sürüm zorlanmaz', () {
      expect(
        isForceUpdateRequired(currentVersionCode: 7, data: {'minVersionCode': 7}),
        isFalse,
      );
      expect(
        isForceUpdateRequired(currentVersionCode: 9, data: {'minVersionCode': 7}),
        isFalse,
      );
    });

    test('sunucu forceUpdate gönderdiyse yine zorlanır', () {
      expect(
        isForceUpdateRequired(currentVersionCode: 99, data: {'forceUpdate': true}),
        isTrue,
      );
    });

    test('eşik alanı yoksa ya da 0 ise zorlama olmaz', () {
      expect(isForceUpdateRequired(currentVersionCode: 1, data: const {}), isFalse);
      expect(
        isForceUpdateRequired(currentVersionCode: 1, data: {'minVersionCode': 0}),
        isFalse,
      );
    });

    test('bölünmüş paketin ham kodu (2022) yayın numarasına (22) indirgenerek karşılaştırılır', () {
      expect(isForceUpdateRequired(currentVersionCode: 2022, data: {'minVersionCode': 30}), isTrue);
      expect(isForceUpdateRequired(currentVersionCode: 2022, data: {'minVersionCode': 22}), isFalse);
    });
  });

  group('releaseNumber', () {
    test('mimari payını atar: arm64 2022, armeabi 1022, evrensel 22 hepsi 22', () {
      expect(releaseNumber(2022), 22);
      expect(releaseNumber(1022), 22);
      expect(releaseNumber(22), 22);
      expect(releaseNumber(0), 0);
    });
  });

  group('isUpdateAvailable', () {
    test('bölünmüş paket kurulu telefon sonraki yayını görür (eskiden 2022 > 23 sanılıp hiç görmezdi)', () {
      expect(isUpdateAvailable(installedCode: 2022, remoteCode: 23), isTrue);
      expect(isUpdateAvailable(installedCode: 2022, remoteCode: 2023), isTrue);
    });

    test('güncel telefon güncelleme görmez: sunucu ham kod da yayın numarası da bildirse', () {
      expect(isUpdateAvailable(installedCode: 2022, remoteCode: 22), isFalse);
      expect(isUpdateAvailable(installedCode: 2022, remoteCode: 2022), isFalse);
      // Evrensel paket kurulu telefona sunucu mimariye özel ham kod (2022) bildirse de aynı sürüm için çağrı çıkmaz.
      expect(isUpdateAvailable(installedCode: 22, remoteCode: 2022), isFalse);
      expect(isUpdateAvailable(installedCode: 1022, remoteCode: 2022), isFalse);
    });

    test('eski sürüm güncellemeyi görür', () {
      expect(isUpdateAvailable(installedCode: 7, remoteCode: 22), isTrue);
      expect(isUpdateAvailable(installedCode: 1021, remoteCode: 2022), isTrue);
    });
  });
}
