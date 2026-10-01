import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/models/damage_report.dart';

void main() {
  test('kurumsal kaynakların temiz yazımlarını orijinal sayar', () {
    for (final text in ['Boya/değişen yok', 'Boya/değişen yok (tüm parçalar orijinal)', 'Boyasız', 'Tamamı orjinal']) {
      final report = parseDamageReport(text);
      expect(report.level, DamageLevel.original, reason: text);
      expect(report.unknown, isFalse, reason: text);
    }
  });

  test('sayıları okur, bilinmeyeni ayırır', () {
    final report = parseDamageReport('1 değişen, 2 boyalı, 1 lokal boyalı');
    expect(report.changed, 1);
    expect(report.painted, 2);
    expect(report.localPainted, 1);
    expect(parseDamageReport('Belirtilmemiş').level, DamageLevel.unknown);
    expect(parseDamageReport('').level, DamageLevel.unknown);
  });
}
