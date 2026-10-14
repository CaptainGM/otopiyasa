import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/models/car.dart';

void main() {
  test('detay yanıtındaki ilan kalitesi okunur; liste kartında (alan yok) null kalır', () {
    final detail = CarListing.fromJson({
      '_id': 'abc',
      'quality': {
        'score': 72,
        'items': [
          {'key': 'fotograf', 'label': 'Fotoğraf', 'earned': 20, 'max': 35, 'note': '5 fotoğraf'},
          {'key': 'hasar', 'label': 'Hasar / boya bilgisi', 'earned': 0, 'max': 25, 'note': 'Bilgi verilmemiş'},
        ],
      },
    });
    expect(detail.quality, isNotNull);
    expect(detail.quality!.score, 72);
    expect(detail.quality!.items.length, 2);
    expect(detail.quality!.items.first.label, 'Fotoğraf');
    expect(detail.quality!.items.first.earned, 20);
    expect(detail.quality!.items.first.max, 35);

    final listCard = CarListing.fromJson({'_id': 'def'});
    expect(listCard.quality, isNull);
  });

  test('bozuk ya da puansız ilan kalitesi yok sayılır (uygulama çökmez)', () {
    expect(ListingCompleteness.fromJson(null), isNull);
    expect(ListingCompleteness.fromJson('metin'), isNull);
    expect(ListingCompleteness.fromJson({'items': []}), isNull);
    final partial = ListingCompleteness.fromJson({'score': 40, 'items': [{'label': 'Açıklama'}]});
    expect(partial!.score, 40);
    expect(partial.items.single.earned, 0);
    expect(partial.items.single.max, 0);
  });
}
