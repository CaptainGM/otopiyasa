import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/utils/market_position.dart';

void main() {
  group('MarketPosition.of', () {
    test('emsal yetersizse gösterge yok', () {
      expect(MarketPosition.of(1_000_000, 1_000_000, 2), isNull);
      expect(MarketPosition.of(1_000_000, 0, 10), isNull);
      expect(MarketPosition.of(1_000_000, null, null), isNull);
    });

    test('±%6 içi piyasa değerinde', () {
      final p = MarketPosition.of(1_040_000, 1_000_000, 8)!;
      expect(p.band, MarketBand.fair);
      expect(p.pct, 4);
    });

    test('ucuz, pahalı ve şüpheli ucuz bantları', () {
      expect(MarketPosition.of(880_000, 1_000_000, 5)!.band, MarketBand.cheap);
      expect(MarketPosition.of(1_150_000, 1_000_000, 5)!.band, MarketBand.pricey);
      expect(MarketPosition.of(650_000, 1_000_000, 5)!.band, MarketBand.suspicious);
    });

    test('ortalamanın kat be kat üstündeki fiyat veri hatası olarak işaretlenir', () {
      // Web ile aynı kural (bkz. src/lib/market-position.ts): canlıda görülen 1990 Renault R 9,
      // 105.000.000 TL vakası. Yüzde gösterilmez, "Piyasa dışı fiyat" yazılır.
      final absurd = MarketPosition.of(105_000_000, 141_000, 86)!;
      expect(absurd.band, MarketBand.invalid);
      expect(absurd.label, 'Piyasa dışı fiyat');
      expect(absurd.label.contains('%'), isFalse);
    });

    test('sınır: 5 katı geçmeyen fiyat normal "pahalı" kalır', () {
      // Yüzde tamsayıya yuvarlandığı için sınır testi belirsiz olmayan değerlerle yapılır.
      expect(MarketPosition.of(4 * 1_000_000, 1_000_000, 5)!.band, MarketBand.pricey);
      expect(MarketPosition.of(6 * 1_000_000, 1_000_000, 5)!.band, MarketBand.invalid);
    });
  });
}
