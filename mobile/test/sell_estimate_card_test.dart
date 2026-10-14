import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/models/sell_estimate.dart';
import 'package:otopiyasa/widgets/sell_estimate_card.dart';

SellEstimate _estimate() => SellEstimate.fromJson({
      'confident': true,
      'reason': '',
      'tier': {'key': 'km', 'label': 'Yıl ±2 ve km yakın', 'n': 20, 'p25': 900000, 'median': 1000000, 'p75': 1100000},
      'damageKnown': true,
      'warnings': ['Kilometre, yaşına göre çok yüksek görünüyor. Kontrol et.'],
      'thresholds': {'highBlock': 2.5, 'lowBlock': 0.4, 'warnLow': 0.8, 'warnHigh': 1.2},
    });

/// Form, 320 px genişlikte ve büyütülmüş yazı boyutunda taşmamalı (bkz. listing_quality_badge_test).
Future<void> _pump(WidgetTester tester, double textScale, Widget card) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(320, 900);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(size: const Size(320, 900), textScaler: TextScaler.linear(textScale)),
        child: Scaffold(
          body: ListView(padding: const EdgeInsets.all(16), children: [card]),
        ),
      ),
    ),
  );
}

void main() {
  for (final scale in [1.0, 1.4]) {
    testWidgets('aralık kartı 320 px ve ${scale}x yazıda taşmaz; engel mesajı görünür', (tester) async {
      final estimate = _estimate();
      await _pump(
        tester,
        scale,
        SellEstimateCard(
          ready: true,
          loading: false,
          error: null,
          estimate: estimate,
          damage: 'orijinal',
          guard: sellPriceGuard(2500000, estimate),
        ),
      );
      expect(tester.takeException(), isNull);
      expect(find.textContaining('2,5 katından'), findsOneWidget);
      expect(find.textContaining('Yıl ±2 ve km yakın'), findsOneWidget);
    });
  }

  testWidgets('eksik bilgide kart aralık yerine ne yazılacağını söyler', (tester) async {
    await _pump(
      tester,
      1.4,
      const SellEstimateCard(ready: false, loading: false, error: null, estimate: null, damage: null, guard: SellPriceGuard.none),
    );
    expect(tester.takeException(), isNull);
    expect(find.textContaining('hasar durumunu seçince'), findsOneWidget);
  });
}
