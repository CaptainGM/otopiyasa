import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/screens/photo_viewer_screen.dart';

const _images = ['https://images.example.com/1.jpg', 'https://images.example.com/2.jpg', 'https://images.example.com/3.jpg'];
const _single = 'https://images.example.com/1.jpg';

void main() {
  testWidgets('normal boyutta sola kaydırma sonraki fotoğrafa geçirir', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: PhotoViewerScreen(images: _images)));
    expect(find.text('1 / 3'), findsOneWidget);

    await tester.drag(find.byType(PageView), const Offset(-500, 0));
    await tester.pumpAndSettle();

    expect(find.text('2 / 3'), findsOneWidget);
  });

  testWidgets('çift dokunuşla yakınlaşınca kaydırma fotoğrafı gezdirir, sayfayı değiştirmez', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: PhotoViewerScreen(images: _images)));
    final center = tester.getCenter(find.byType(PageView));

    await tester.tapAt(center);
    await tester.pump(const Duration(milliseconds: 80));
    await tester.tapAt(center);
    await tester.pumpAndSettle();

    await tester.drag(find.byType(InteractiveViewer).first, const Offset(-500, 0));
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
