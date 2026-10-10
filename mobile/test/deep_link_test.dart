import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/utils/deep_link.dart';

void main() {
  const id = '65f1a2b3c4d5e6f701234567';

  group('carIdFromDeepLink', () {
    test('web bağlantısını çözer', () {
      expect(carIdFromDeepLink('https://otopiyasa.app/cars/$id'), id);
    });

    test('özel şemayı çözer (cars host kısmına düşer)', () {
      expect(carIdFromDeepLink('otopiyasa://cars/$id'), id);
    });

    test('sondaki eğik çizgiyi ve sorgu dizesini yok sayar', () {
      expect(carIdFromDeepLink('https://otopiyasa.app/cars/$id/'), id);
      expect(carIdFromDeepLink('https://otopiyasa.app/cars/$id?utm=bildirim'), id);
    });

    test('ilan olmayan bağlantılarda null döner', () {
      expect(carIdFromDeepLink(null), isNull);
      expect(carIdFromDeepLink(''), isNull);
      expect(carIdFromDeepLink('   '), isNull);
      expect(carIdFromDeepLink('https://otopiyasa.app/offers/$id'), isNull);
      expect(carIdFromDeepLink('https://otopiyasa.app/'), isNull);
      expect(carIdFromDeepLink('rastgele metin'), isNull);
    });

    test('geçersiz kimlikleri kabul etmez', () {
      expect(carIdFromDeepLink('https://otopiyasa.app/cars/kisa'), isNull);
      expect(carIdFromDeepLink('https://otopiyasa.app/cars/$id$id'), isNull);
    });
  });
}
