import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/widgets/car_parts_diagram.dart';

const _names = <String, String>{
  'hood': 'Ön Kaput',
  'roof': 'Tavan',
  'trunk': 'Bagaj',
  'f_l_fender': 'Sol Ön Çamurluk',
  'f_r_fender': 'Sağ Ön Çamurluk',
  'f_l_door': 'Sol Ön Kapı',
  'f_r_door': 'Sağ Ön Kapı',
  'r_l_door': 'Sol Arka Kapı',
  'r_r_door': 'Sağ Arka Kapı',
  'r_l_fender': 'Sol Arka Çamurluk',
  'r_r_fender': 'Sağ Arka Çamurluk',
};

Future<void> _pump(WidgetTester tester, {required double width, required Map<String, String> states, required void Function(String) onToggle}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = Size(width, 900);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          // Tahmin ekranındaki kutunun iç boşluğu gibi: şema ekranın tamamını kaplamaz.
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: CarPartsDiagram(states: states, names: _names, onToggle: onToggle),
          ),
        ),
      ),
    ),
  );
}

void main() {
  test('çizimdeki her parçanın bir adı vardır ve 11 parça tamamdır', () {
    final keys = carPartsDiagramKeys;
    expect(keys.toSet(), _names.keys.toSet());
    expect(keys.length, 11);
  });

  for (final width in [320.0, 360.0, 412.0]) {
    testWidgets('$width dp genişlikte 11 etiketin adı tam yazılır, taşma olmaz', (tester) async {
      await _pump(tester, width: width, states: {for (final key in _names.keys) key: 'original'}, onToggle: (_) {});
      for (final name in _names.values) {
        expect(find.text(name), findsOneWidget, reason: '$name etiketi çizilmeli');
      }
      // Yerleşim hatası (RenderFlex overflow vb.) test çıktısında istisna olarak kalır.
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('etikete dokunmak parça anahtarıyla onToggle çağırır', (tester) async {
    final taps = <String>[];
    await _pump(tester, width: 390, states: {for (final key in _names.keys) key: 'original'}, onToggle: taps.add);
    await tester.tap(find.text('Ön Kaput'));
    await tester.tap(find.text('Sağ Arka Kapı'));
    await tester.tap(find.text('Bagaj'));
    expect(taps, ['hood', 'r_r_door', 'trunk']);
  });

  testWidgets('geniş ekranda durum sözcüğü görünür, dar ekranda gizlenir', (tester) async {
    await _pump(tester, width: 412, states: {for (final key in _names.keys) key: key == 'hood' ? 'replaced' : 'original'}, onToggle: (_) {});
    expect(find.text('DEĞİŞEN'), findsOneWidget);
    expect(find.text('ORİJİNAL'), findsNWidgets(10));

    await _pump(tester, width: 320, states: {for (final key in _names.keys) key: 'original'}, onToggle: (_) {});
    // 320 dp ekranda şema ~288 dp: durum sözcüğü yer açmak için gizlenir (renk durumu söyler).
    expect(find.text('ORİJİNAL'), findsNothing);
  });

  testWidgets('durum haritası yerinde değişse de şema yeniden çizilir (çizici haritanın kopyasını tutar)', (tester) async {
    final states = {for (final key in _names.keys) key: 'original'};
    final hostKey = GlobalKey<_HostState>();
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 900);
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: _Host(key: hostKey, states: states))));
    expect(find.text('ORİJİNAL'), findsNWidgets(11));
    hostKey.currentState!.cycle('hood');
    await tester.pump();
    expect(find.text('BOYALI'), findsOneWidget);
    expect(find.text('ORİJİNAL'), findsNWidgets(10));
  });
}

/// Tahmin ekranındaki gibi durum haritasını yerinde değiştirip setState çağıran sarmalayıcı.
class _Host extends StatefulWidget {
  const _Host({super.key, required this.states});

  final Map<String, String> states;

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  void cycle(String key) => setState(() => widget.states[key] = 'painted');

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: CarPartsDiagram(states: widget.states, names: _names, onToggle: cycle),
        ),
      );
}
