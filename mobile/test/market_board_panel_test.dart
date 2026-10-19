import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/widgets/market_board_panel.dart';

Map<String, dynamic> _board() => {
      'total': 57906,
      'addedLastDay': 339,
      'featured': 2511,
      'sources': 8,
    };

/// 320 px (en dar desteklenen telefon genişliği) ve büyütülmüş yazıda panel taşmamalı, metin kesilmemeli.
Future<void> _pump(WidgetTester tester, double width, double textScale) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = Size(width, 900);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(size: Size(width, 900), textScaler: TextScaler.linear(textScale)),
        child: Scaffold(
          body: ListView(padding: const EdgeInsets.all(16), children: [MarketBoardContent(board: _board())]),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('320 px genişlikte ve 1.0x yazıda taşmaz, dört değer de görünür', (tester) async {
    await _pump(tester, 320, 1.0);
    expect(tester.takeException(), isNull);
    expect(find.text('57.906'), findsOneWidget);
    expect(find.text('+339'), findsOneWidget);
    expect(find.text('2.511'), findsOneWidget);
    expect(find.text('8'), findsOneWidget);
    expect(find.textContaining('Haftanın fırsatları'), findsOneWidget);
  });

  testWidgets('393 px genişlikte ve 1.3x büyütülmüş yazıda taşmaz', (tester) async {
    await _pump(tester, 393, 1.3);
    expect(tester.takeException(), isNull);
  });

  testWidgets('veri yoksa (featured null) kesilmeden tire gösterir', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 900);
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(size: Size(320, 900)),
          child: Scaffold(
            body: ListView(
              padding: const EdgeInsets.all(16),
              children: [MarketBoardContent(board: {'total': 57906, 'addedLastDay': 339, 'sources': 8})],
            ),
          ),
        ),
      ),
    );
    expect(tester.takeException(), isNull);
    expect(find.text('—'), findsOneWidget);
  });
}
