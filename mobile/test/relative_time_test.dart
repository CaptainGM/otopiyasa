import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/utils/relative_time.dart';

void main() {
  final now = DateTime.utc(2026, 9, 30, 12);

  group('relativeTimeTr', () {
    test('web ile aynı kurallarla kısa Türkçe metin üretir', () {
      expect(relativeTimeTr(DateTime.utc(2026, 9, 30, 11, 59, 40), now: now), 'az önce');
      expect(relativeTimeTr(DateTime.utc(2026, 9, 30, 11, 15), now: now), '45 dk önce');
      expect(relativeTimeTr(DateTime.utc(2026, 9, 30, 7), now: now), '5 saat önce');
      expect(relativeTimeTr(DateTime.utc(2026, 9, 27, 12), now: now), '3 gün önce');
      expect(relativeTimeTr(DateTime.utc(2026, 6, 30, 12), now: now), '3 ay önce');
    });

    test('gelecekteki tarihte negatif süre göstermez', () {
      expect(relativeTimeTr(DateTime.utc(2026, 9, 30, 13), now: now), 'az önce');
    });
  });

  group('CarListing yaşam döngüsü alanları', () {
    Map<String, dynamic> json(Map<String, dynamic> extra) => {
          '_id': 'a1',
          'title': 'Renault Clio',
          'sourceSite': 'otokoc',
          'listingUrl': 'https://example.com/ilan/1',
          ...extra,
        };

    test('lastVerifiedAt ve removedAt ayrıştırılır, eski kayıtlarda boş kalır', () {
      final fresh = CarListing.fromJson(json({
        'status': 'removed',
        'lastVerifiedAt': '2026-09-30T08:00:00.000Z',
        'removedAt': '2026-09-30T09:00:00.000Z',
        'removedReason': 'otokoc: satılmış',
      }));
      expect(fresh.lastVerifiedAt, DateTime.utc(2026, 9, 30, 8));
      expect(fresh.removedAt, DateTime.utc(2026, 9, 30, 9));
      expect(fresh.removedReason, 'otokoc: satılmış');
      expect(fresh.statusLabel, 'Kaynaktan kaldırıldı');

      final legacy = CarListing.fromJson(json({}));
      expect(legacy.lastVerifiedAt, isNull);
      expect(legacy.removedAt, isNull);
      expect(legacy.verifiedLabel, '');
    });

    test('kaynakta son kontrol satırı yalnızca aktif kaynak ilanlarında görünür', () {
      final active = CarListing.fromJson(json({'lastVerifiedAt': '2026-09-30T08:00:00.000Z'}));
      expect(active.verifiedLabel, startsWith('Kaynakta son kontrol: '));

      final user = CarListing.fromJson(json({'sourceSite': 'user', 'lastVerifiedAt': '2026-09-30T08:00:00.000Z'}));
      expect(user.verifiedLabel, '');

      final removed = CarListing.fromJson(json({'status': 'removed', 'lastVerifiedAt': '2026-09-30T08:00:00.000Z'}));
      expect(removed.verifiedLabel, '');
    });
  });
}
