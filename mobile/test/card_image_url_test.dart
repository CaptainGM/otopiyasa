import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/widgets/listing_image.dart';

void main() {
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

    test('tanınmayan adreslere ve Arabam görsellerine dokunmaz', () {
      for (final url in [
        'https://arbimg1.mncdn.com/ilanfotograflari/2026/x_800x600.jpg',
        'https://images.dod.com.tr/dodvehicle2/1705291_1_800x600.jpg',
        'https://example.com/photo_1920x1080.jpg',
        '',
      ]) {
        expect(cardImageUrl(url), url);
      }
    });
  });
}
