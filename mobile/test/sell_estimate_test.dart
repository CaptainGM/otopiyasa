import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/models/sell_estimate.dart';

SellEstimate _estimate({bool confident = true, bool damageKnown = true}) => SellEstimate.fromJson({
      'confident': confident,
      'reason': confident ? '' : 'Bu araç için yeterli benzer ilan yok; fiyat aralığı gösterilmiyor.',
      'tier': confident
          ? {'key': 'km', 'label': 'Yıl ±2 ve km yakın', 'n': 20, 'p25': 900000, 'median': 1000000, 'p75': 1100000}
          : null,
      'damageKnown': damageKnown,
      'warnings': <String>[],
      'thresholds': {'highBlock': 2.5, 'lowBlock': 0.4, 'warnLow': 0.8, 'warnHigh': 1.2},
    });

void main() {
  test('tutar Türkçe binlik ayraçla yazılır', () {
    expect(formatLira(1430000), '1.430.000 TL');
    expect(formatLira(950), '950 TL');
  });

  test('orta değerin 2,5 katı ve üzeri engellenir (metinde Türkçe ondalık)', () {
    final guard = sellPriceGuard(2500000, _estimate());
    expect(guard.level, SellGuardLevel.block);
    expect(guard.message, contains('2,5 katından'));
  });

  test('düşük uç yalnızca hasar bilgisi varken engellenir', () {
    expect(sellPriceGuard(400000, _estimate(damageKnown: true)).level, SellGuardLevel.block);
    expect(sellPriceGuard(400000, _estimate(damageKnown: false)).level, isNot(SellGuardLevel.block));
  });

  test('aralığın dışı yalnızca uyarıdır, aralık içi sessizdir', () {
    expect(sellPriceGuard(700000, _estimate()).level, SellGuardLevel.warn);
    expect(sellPriceGuard(1000000, _estimate()).level, SellGuardLevel.none);
  });

  test('güvenilir aralık yoksa ya da fiyat boşsa kural uygulanmaz', () {
    expect(sellPriceGuard(9999999999, _estimate(confident: false)).level, SellGuardLevel.none);
    expect(sellPriceGuard(0, _estimate()).level, SellGuardLevel.none);
  });

  test('eşikler sunucudan okunur, eksikse web ile aynı varsayılan kullanılır', () {
    final fromServer = SellThresholds.fromJson({'highBlock': 3, 'lowBlock': 0.5, 'warnLow': 0.7, 'warnHigh': 1.3});
    expect(fromServer.highBlock, 3);
    expect(SellThresholds.fromJson(null).highBlock, 2.5);
  });
}
