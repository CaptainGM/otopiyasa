import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/widgets/listing_image.dart';

void main() {
  const arabam =
      'https://arbstorage.mncdn.com/ilanfotograflari/2026/07/19/42188516/a882c63a_image_for_silan_42188516_1920x1080.jpg';

  group('cardImageUrl', () {
    test('Carvak, Otoplus ve Otokoç için kart boyutunda hafif varyant seçer', () {
      expect(
        cardImageUrl('https://img.carvak.co/image/upload/w_1920,h_1080,c_thumb,g_auto/uploads/1.jpg'),
        'https://img.carvak.co/image/upload/w_640,h_360,c_thumb,g_auto/uploads/1.jpg',
      );
      expect(
        cardImageUrl('https://cdn.otoplus.com/img/u/v/d6/arac-1_1920x1080.jpg'),
        'https://cdn.otoplus.com/img/u/v/d6/arac-1_1280x720.jpg',
      );
      expect(
        cardImageUrl('https://2el-cdn.otokoc.com.tr/otokoc2el/car/640x/a.webp'),
        'https://2el-cdn.otokoc.com.tr/otokoc2el/car/450x/a.webp',
      );
    });

    test('Arabam görselinde 580x435 kullanır (357 KB yerine ~61 KB)', () {
      expect(cardImageUrl(arabam), arabam.replaceFirst('_1920x1080.jpg', '_580x435.jpg'));
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
      expect(imageCandidates(arabam, small: true), [
        arabam.replaceFirst('_1920x1080.jpg', '_580x435.jpg'),
        arabam,
        arabam.replaceFirst('_1920x1080.jpg', '_800x600.jpg'),
      ]);
    });

    test('tam ekran galeride orijinalle başlar', () {
      expect(imageCandidates(arabam, small: false).first, arabam);
      expect(imageCandidates('https://example.com/a.jpg', small: false), ['https://example.com/a.jpg']);
    });
  });
}
