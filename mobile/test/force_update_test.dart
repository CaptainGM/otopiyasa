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
  });
}
