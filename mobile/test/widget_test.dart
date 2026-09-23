import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/models/car.dart';

void main() {
  group('CarListing.fromJson', () {
    test('API yanıtını tüm alanlarla ayrıştırır', () {
      final car = CarListing.fromJson({
        '_id': 'abc123',
        'title': '2020 Toyota Corolla 1.6 Dream',
        'brand': 'Toyota',
        'model': 'Corolla',
        'year': 2020,
        'price': 950000,
        'mileage': 85000,
        'city': 'İstanbul',
        'description': 'Temiz araç',
        'imageUrl': 'https://example.com/car.jpg',
        'sourceSite': 'arabam',
        'listingUrl': 'https://www.arabam.com/ilan/123',
        'marketAvgPrice': 1000000,
        'features': {
          'fuelType': 'Benzin',
          'transmission': 'Otomatik',
          'bodyType': 'Sedan',
        },
        'priceHistory': [
          {'price': 980000, 'recordedAt': '2026-06-01T10:00:00.000Z'},
          {'price': 950000, 'recordedAt': '2026-07-01T10:00:00.000Z'},
        ],
      });

      expect(car.id, 'abc123');
      expect(car.brand, 'Toyota');
      expect(car.price, 950000);
      expect(car.fuelType, 'Benzin');
      expect(car.priceHistory, hasLength(2));
      expect(car.priceHistory.first.price, 980000);
      expect(car.priceHistory.first.recordedAt.year, 2026);
    });

    test('eksik alanlarda varsayılanlarla çalışır', () {
      final car = CarListing.fromJson({'_id': 'x'});
      expect(car.title, '');
      expect(car.price, 0);
      expect(car.fuelType, 'Bilinmiyor');
      expect(car.priceHistory, isEmpty);
    });
  });

  group('CarsResponse.fromJson', () {
    test('sayfalama alanlarını ayrıştırır', () {
      final response = CarsResponse.fromJson({
        'items': [
          {'_id': 'a'},
          {'_id': 'b'},
        ],
        'total': 42,
        'page': 2,
        'totalPages': 5,
      });

      expect(response.items, hasLength(2));
      expect(response.total, 42);
      expect(response.page, 2);
      expect(response.totalPages, 5);
    });
  });
}
