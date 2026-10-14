import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/widgets/compare_add_slot.dart';

void main() {
  // Karşılaştırma sütunu, sayfa kenar boşluğu (8 px ×2) ve etiket sütunu (58 px) düşülerek iki araçlık genişlikte çizilir.
  // Dar ekran (320 px) ve büyük yazı için taşma (RenderFlex overflow) hatası testte yakalanır.
  for (final screenWidth in [320.0, 360.0, 393.0]) {
    for (final textScale in [1.0, 1.4]) {
      testWidgets('araç ekle sütunu ${screenWidth.toInt()} px ekranda, yazı x$textScale taşmadan çizilir', (tester) async {
        final columnWidth = (screenWidth - 16 - 58) / 2;
        final imageWidth = columnWidth - 6;
        final imageHeight = imageWidth * 0.72;
        final headerHeight = imageHeight + 40;

        await tester.pumpWidget(
          MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(size: Size(screenWidth, 700), textScaler: TextScaler.linear(textScale)),
              child: Scaffold(
                body: Row(
                  children: [
                    CompareAddSlot(
                      width: columnWidth,
                      imageWidth: imageWidth,
                      imageHeight: imageHeight,
                      headerHeight: headerHeight,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Sağ tarafa bir araç daha ekle'), findsOneWidget);
        expect(find.text('En az 2 araç gerekli'), findsOneWidget);
      });
    }
  }
}
