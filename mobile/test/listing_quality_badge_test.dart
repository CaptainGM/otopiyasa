import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/widgets/listing_quality_badge.dart';

const _quality = ListingCompleteness(
  score: 88,
  items: [
    CompletenessItem(label: 'Fotoğraf', earned: 25, max: 25, note: '12 fotoğraf (en az 10 tam puan)'),
    CompletenessItem(label: 'Açıklama', earned: 18, max: 30, note: '320 karakter, 4/6 bilgi konusu'),
    CompletenessItem(label: 'Hasar / boya bilgisi', earned: 0, max: 15, note: 'Bilgi verilmemiş'),
    CompletenessItem(label: 'Temel özellikler', earned: 30, max: 30, note: 'Yakıt, vites, kasa tipi, renk ve motor hacmi belli'),
  ],
);

void main() {
  // Telefon genişliği (320 px) ve büyük yazı: rozet ve panel taşmadan çizilmeli (RenderFlex hatası testte yakalanır).
  for (final width in [320.0, 393.0]) {
    for (final scale in [1.0, 1.4]) {
      testWidgets('ilan kalitesi rozeti ${width.toInt()} px, yazı x$scale taşmadan açılır', (tester) async {
        await tester.pumpWidget(
          MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(size: Size(width, 700), textScaler: TextScaler.linear(scale)),
              // Detay ekranı da bir ListView içinde: panel kaydırılabilir alanda, yüksekliği sınırsız.
              child: Scaffold(
                body: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [ListingQualityBadge(quality: _quality)],
                ),
              ),
            ),
          ),
        );

        // Kapalıyken rozette yalnızca puan yazar; kalemler ve "İlan kalitesi" başlığı görünmez.
        expect(find.text('88'), findsOneWidget);
        expect(find.textContaining('İlan kalitesi'), findsNothing);
        expect(find.text('Fotoğraf'), findsNothing);

        await tester.tap(find.text('88'));
        await tester.pump();

        expect(tester.takeException(), isNull);
        expect(find.text('İlan kalitesi 88'), findsOneWidget);
        expect(find.text('Fotoğraf'), findsOneWidget);
        expect(find.text('25/25'), findsOneWidget);
        expect(find.textContaining('aracın durumunu ya da satıcının güvenilirliğini ölçmez'), findsOneWidget);
      });
    }
  }
}
