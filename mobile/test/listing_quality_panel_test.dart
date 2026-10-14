import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/widgets/listing_quality_panel.dart';

const _quality = ListingCompleteness(
  score: 88,
  items: [
    CompletenessItem(label: 'Fotoğraf', earned: 35, max: 35, note: '8 fotoğraf'),
    CompletenessItem(label: 'Açıklama', earned: 10, max: 15, note: '120 karakter'),
    CompletenessItem(label: 'Hasar / boya bilgisi', earned: 0, max: 25, note: 'Bilgi verilmemiş'),
    CompletenessItem(label: 'Temel özellikler', earned: 25, max: 25, note: 'Yakıt, vites, kasa tipi ve renk belli'),
  ],
);

void main() {
  // Telefon genişliği (320 px) ve büyük yazı: kalemler ve açıklama taşmadan çizilmeli (RenderFlex hatası testte yakalanır).
  for (final width in [320.0, 393.0]) {
    for (final scale in [1.0, 1.4]) {
      testWidgets('ilan kalitesi paneli ${width.toInt()} px, yazı x$scale taşmadan açılır', (tester) async {
        await tester.pumpWidget(
          MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(size: Size(width, 700), textScaler: TextScaler.linear(scale)),
              // Detay ekranı da bir ListView içinde: panel kaydırılabilir alanda, yüksekliği sınırsız.
              child: Scaffold(
                body: ListView(
                  padding: EdgeInsets.all(16),
                  children: [ListingQualityPanel(quality: _quality)],
                ),
              ),
            ),
          ),
        );

        // Kapalıyken kalemler görünmez; puan görünür.
        expect(find.text('88/100'), findsOneWidget);
        expect(find.text('Fotoğraf'), findsNothing);

        await tester.tap(find.text('88/100'));
        await tester.pump();

        expect(tester.takeException(), isNull);
        expect(find.text('Fotoğraf'), findsOneWidget);
        expect(find.text('35/35'), findsOneWidget);
        expect(find.textContaining('aracın durumunu ya da satıcının güvenilirliğini ölçmez'), findsOneWidget);
      });
    }
  }
}
