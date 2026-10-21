import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/screens/photo_viewer_screen.dart';

const _images = ['https://images.example.com/1.jpg', 'https://images.example.com/2.jpg', 'https://images.example.com/3.jpg'];
const _single = 'https://images.example.com/1.jpg';

/// Fotoğrafın anlık ölçeği (Transform matrisinden).
double _scaleOf(WidgetTester tester) =>
    tester.widget<Transform>(find.byKey(const ValueKey('zoom-transform'))).transform.getMaxScaleOnAxis();

void main() {
  testWidgets('normal boyutta sola kaydırma sonraki fotoğrafa geçirir', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: PhotoViewerScreen(images: _images)));
    expect(find.text('1 / 3'), findsOneWidget);

    await tester.drag(find.byType(PageView), const Offset(-500, 0));
    await tester.pumpAndSettle();

    expect(find.text('2 / 3'), findsOneWidget);
  });

  testWidgets('iki parmakla yakınlaşır, sayfa değişmez; geri çekilince normal boyut ve kaydırma geri gelir', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: PhotoViewerScreen(images: _images)));
    final center = tester.getCenter(find.byType(PageView));

    final first = await tester.startGesture(center + const Offset(-40, 0), pointer: 1);
    final second = await tester.startGesture(center + const Offset(40, 0), pointer: 2);
    await tester.pump();
    // Parmaklar açılıyor: aralık 80 → 200 px, ölçek yaklaşık 2,5.
    await first.moveBy(const Offset(-60, 0));
    await second.moveBy(const Offset(60, 0));
    await tester.pump();

    expect(_scaleOf(tester), greaterThan(2));
    expect(find.text('1 / 3'), findsOneWidget);

    await first.up();
    await second.up();
    await tester.pumpAndSettle();

    // Parmaklar kapanıyor: aralık 200 → 80 px, ölçek 1'e iner.
    final third = await tester.startGesture(center + const Offset(-100, 0), pointer: 3);
    final fourth = await tester.startGesture(center + const Offset(100, 0), pointer: 4);
    await tester.pump();
    await third.moveBy(const Offset(60, 0));
    await fourth.moveBy(const Offset(-60, 0));
    await tester.pump();
    await third.up();
    await fourth.up();
    await tester.pumpAndSettle();

    expect(_scaleOf(tester), 1);
    await tester.drag(find.byType(PageView), const Offset(-500, 0));
    await tester.pumpAndSettle();
    expect(find.text('2 / 3'), findsOneWidget);
  });

  testWidgets('çift dokunuşla yakınlaşınca tek parmak gezdirir, sayfayı değiştirmez', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: PhotoViewerScreen(images: _images)));
    final center = tester.getCenter(find.byType(PageView));

    await tester.tapAt(center);
    await tester.pump(const Duration(milliseconds: 80));
    await tester.tapAt(center);
    await tester.pumpAndSettle();
    expect(_scaleOf(tester), greaterThan(2));

    await tester.drag(find.byKey(const ValueKey('zoom-transform')), const Offset(-200, 0));
    await tester.pumpAndSettle();

    expect(find.text('1 / 3'), findsOneWidget);
  });

  testWidgets('açılış fotoğrafı dokunulan sıradan başlar', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: PhotoViewerScreen(images: _images, initialIndex: 2)));
    expect(find.text('3 / 3'), findsOneWidget);
  });

  testWidgets('tek fotoğrafta sayaç gösterilmez', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: PhotoViewerScreen(images: [_single])));
    expect(find.textContaining('/'), findsNothing);
  });
}
