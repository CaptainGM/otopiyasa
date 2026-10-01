import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/widgets/listing_image.dart';

void main() {
  const arabam =
      'https://arbstorage.mncdn.com/ilanfotograflari/2026/07/19/42188516/a882c63a_image_for_silan_42188516_1920x1080.jpg';

  group('cardImageUrl', () {
    test('Carvak ve Otokoç için kart boyutunda hafif varyant seçer', () {
      expect(
        cardImageUrl('https://img.carvak.co/image/upload/w_1920,h_1080,c_thumb,g_auto/uploads/1.jpg', lowData: false),
        'https://img.carvak.co/image/upload/w_480,h_270,c_thumb,g_auto/uploads/1.jpg',
      );
      expect(
        cardImageUrl('https://2el-cdn.otokoc.com.tr/otokoc2el/car/640x/a.webp'),
        'https://2el-cdn.otokoc.com.tr/otokoc2el/car/450x/a.webp',
      );
    });

    test('Arabam görselinde 580x435 kullanır (357 KB yerine ~50 KB)', () {
      expect(cardImageUrl(arabam, lowData: false), arabam.replaceFirst('_1920x1080.jpg', '_580x435.jpg'));
    });

    test('veri tasarrufunda Arabam 240x180 (~10 KB), Carvak 320 px kullanır', () {
      expect(cardImageUrl(arabam, lowData: true), arabam.replaceFirst('_1920x1080.jpg', '_240x180.jpg'));
      expect(
        cardImageUrl('https://img.carvak.co/image/upload/w_1920,h_1080,c_thumb,g_auto/uploads/1.jpg', lowData: true),
        'https://img.carvak.co/image/upload/w_320,h_180,c_thumb,g_auto/uploads/1.jpg',
      );
    });

    test('küçük boyut sunmayan kaynakları sunucuda küçültülen adrese çevirir', () {
      const vava = 'https://dat-tr-prda-ops-vava.azureedge.net/cars/1/documents/a.webp';
      final normal = cardImageUrl(vava, lowData: false);
      final low = cardImageUrl(vava, lowData: true);
      expect(normal, contains('/api/img?u='));
      expect(normal, contains(Uri.encodeComponent(vava)));
      expect(normal, endsWith('&w=480'));
      expect(low, endsWith('&w=320'));
      expect(cardImageUrl('https://asset.otomerkezi.net/car-photo/1_x.jpeg', lowData: false), contains('/api/img?u='));
      expect(cardImageUrl('https://cdn.otoplus.com/img/u/v/d6/arac-1_1920x1080.jpg', lowData: false), contains('/api/img?u='));
    });

    test('tanınmayan adreslere dokunmaz', () {
      for (final url in [
        'https://images.dod.com.tr/dodvehicle2/1705291_1_800x600.jpg',
        'https://example.com/photo_1920x1080.jpg',
        '',
      ]) {
        expect(cardImageUrl(url), url);
      }
    });
  });

  group('imageCandidates', () {
    test('kartta önce hafif varyant, sonra orijinal, en son 800x600 denenir', () {
      expect(imageCandidates(arabam, small: true, lowData: false), [
        arabam.replaceFirst('_1920x1080.jpg', '_580x435.jpg'),
        arabam,
        arabam.replaceFirst('_1920x1080.jpg', '_800x600.jpg'),
      ]);
    });

    test('tam ekran galeride orijinalle başlar, veri tasarrufunda 800x600 ile', () {
      expect(imageCandidates(arabam, small: false, lowData: false).first, arabam);
      expect(imageCandidates(arabam, small: false, lowData: true).first, arabam.replaceFirst('_1920x1080.jpg', '_800x600.jpg'));
      expect(imageCandidates('https://example.com/a.jpg', small: false, lowData: false), ['https://example.com/a.jpg']);
    });

    test('çok küçük önizleme Arabam''da 240x180', () {
      expect(tinyImageUrl(arabam), arabam.replaceFirst('_1920x1080.jpg', '_240x180.jpg'));
    });
  });
}
