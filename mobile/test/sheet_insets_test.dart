import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/widgets/favorite_sheets.dart';
import 'package:otopiyasa/widgets/sheet_insets.dart';

const _screenHeight = 800.0;
const _navBar = 48.0; // 3 tuşlu gezinme çubuğu

/// Android 15+ gibi ekranı sistem çubuklarının arkasına kadar çizen bir cihazı taklit eder: alt kenarda 48 dp sistem boşluğu.
Widget _edgeToEdgeApp({double navBar = _navBar, required Widget home}) => MaterialApp(
      theme: AppTheme.dark,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(
          padding: EdgeInsets.only(bottom: navBar),
          viewPadding: EdgeInsets.only(bottom: navBar),
        ),
        child: child!,
      ),
      home: home,
    );

void main() {
  testWidgets('"Yeni liste oluştur" düğmesi sistem gezinme çubuğunun altında kalmaz', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(400, _screenHeight);
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _edgeToEdgeApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () => showFavoriteListPicker(
                  context,
                  title: 'Hangi listeye ekleyelim?',
                  lists: const [FavoriteList(id: FavoriteList.defaultId, name: 'Favori Listem', carIds: [])],
                ),
                child: const Text('aç'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('aç'));
    await tester.pumpAndSettle();

    final button = find.text('Yeni liste oluştur');
    expect(button, findsOneWidget);
    // Düğmenin alt kenarı sistem çubuğunun üst kenarının (800 - 48) üstünde olmalı; eskiden 16 dp boşlukla çubuğun içine giriyordu.
    expect(tester.getBottomLeft(button).dy, lessThanOrEqualTo(_screenHeight - _navBar));
  });

  testWidgets('sheetBottomInset: çubuk varken çubuk, klavye varken klavye (ikisi birden değil)', (tester) async {
    late double barOnly;
    late double keyboardUp;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Column(
            children: [
              MediaQuery(
                data: MediaQuery.of(context).copyWith(padding: const EdgeInsets.only(bottom: 48), viewInsets: EdgeInsets.zero),
                child: Builder(builder: (inner) {
                  barOnly = sheetBottomInset(inner);
                  return const SizedBox();
                }),
              ),
              // Klavye açıkken Flutter alt boşluğu 0'a indirir; klavye yüksekliği viewInsets'te gelir.
              MediaQuery(
                data: MediaQuery.of(context).copyWith(padding: EdgeInsets.zero, viewInsets: const EdgeInsets.only(bottom: 300)),
                child: Builder(builder: (inner) {
                  keyboardUp = sheetBottomInset(inner);
                  return const SizedBox();
                }),
              ),
            ],
          ),
        ),
      ),
    );
    expect(barOnly, 48);
    expect(keyboardUp, 300);
  });
}
