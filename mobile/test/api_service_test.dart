import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/services/api_service.dart';

void main() {
  group('ApiService.optimizedListingImageUrl', () {
    test('resizes supported image hosts through the application optimizer', () {
      final result = ApiService().optimizedListingImageUrl(
        'https://www.arabam.com/cars/photo.jpg',
        width: 420,
      );

      expect(result, contains('/_next/image?'));
      expect(result, contains('w=420'));
      expect(result, contains('q=75'));
    });

    test('leaves unsupported and non-HTTPS image hosts untouched', () {
      expect(
        ApiService().optimizedListingImageUrl('https://arbstorage.mncdn.com/cars/photo.jpg'),
        isNull,
      );
      expect(
        ApiService().optimizedListingImageUrl('https://images.dod.com.tr/car.jpg'),
        isNull,
      );
      expect(
        ApiService().optimizedListingImageUrl('http://images.unsplash.com/car.jpg'),
        isNull,
      );
    });
  });
}
