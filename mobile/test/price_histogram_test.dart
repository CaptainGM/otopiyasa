import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/widgets/price_histogram.dart';

void main() {
  const bins = [
    PriceBin(label: '0 - 500B ₺', count: 120, isCurrent: false),
    PriceBin(label: '500B - 1M ₺', count: 300, isCurrent: true),
    PriceBin(label: '1M - 2M ₺', count: 80, isCurrent: false),
    PriceBin(label: '2M - 4M ₺', count: 0, isCurrent: false),
  ];

  Future<void> pump(WidgetTester tester) => tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: PriceHistogramChart(bins: bins, segmentLabel: 'Test segmenti'),
            ),
          ),
        ),
      );

  testWidgets('ilk açılışta "Bu araç" dilimi seçili gelir ve bilgisi görünür', (tester) async {
    await pump(tester);
    expect(find.text('500B - 1M ₺: 300 ilan (%60) · Bu araç bu aralıkta'), findsOneWidget);
  });

  testWidgets('kısa bir dilime dokunmak o dilimin bilgisini gösterir', (tester) async {
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('price-bin-2')));
    await tester.pump();
    expect(find.text('1M - 2M ₺: 80 ilan (%16)'), findsOneWidget);
    expect(find.text('500B - 1M ₺: 300 ilan (%60) · Bu araç bu aralıkta'), findsNothing);
  });

  testWidgets('sıfır ilanlı dilim de seçilebilir', (tester) async {
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('price-bin-3')));
    await tester.pump();
    expect(find.text('2M - 4M ₺: 0 ilan (%0)'), findsOneWidget);
  });
}
