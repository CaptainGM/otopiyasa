import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:otopiyasa/screens/analytics_screen.dart';
import 'package:otopiyasa/screens/compare_screen.dart';
import 'package:otopiyasa/screens/deger_kaybi_screen.dart';
import 'package:otopiyasa/screens/home_screen.dart';
import 'package:otopiyasa/screens/map_screen.dart';
import 'package:otopiyasa/screens/more_screen.dart';
import 'package:otopiyasa/screens/predict_screen.dart';

/// Uygulamanın iskeleti: alt gezinme çubuğu (Keşfet, Harita, Analiz, Değer kaybı, Karşılaştır, Tahmin, Hesap). Sekmeler ilk açıldıklarında
/// kurulur (harita ve analiz, kullanıcı hiç açmadan veri indirmesin) ve sonra durumlarını korur.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;
  final Set<int> _opened = {0};
  // Karşılaştırma listesi başka ekranlardan değişir (ilandan "karşılaştırmaya ekle"); sekmeye her girişte yeniden kurulur.
  int _compareVersion = 0;

  static const _tabs = <({IconData icon, IconData selected, String label})>[
    (icon: Icons.explore_outlined, selected: Icons.explore, label: 'Keşfet'),
    (icon: Icons.map_outlined, selected: Icons.map, label: 'Harita'),
    (icon: Icons.insights_outlined, selected: Icons.insights, label: 'Analiz'),
    (icon: Icons.trending_down_outlined, selected: Icons.trending_down, label: 'Değer'),
    (icon: Icons.compare_arrows_outlined, selected: Icons.compare_arrows, label: 'Kıyasla'),
    (icon: Icons.calculate_outlined, selected: Icons.calculate, label: 'Tahmin'),
    (icon: Icons.person_outline, selected: Icons.person, label: 'Hesap'),
  ];

  Widget _build(int i) {
    switch (i) {
      case 0:
        return const HomeScreen();
      case 1:
        return const MapScreen();
      case 2:
        return const AnalyticsScreen();
      case 3:
        return const DegerKaybiScreen();
      case 4:
        return const CompareScreen();
      case 5:
        return const PredictScreen();
      default:
        return const MoreScreen();
    }
  }

  void _select(int i) {
    if (i == _index) return;
    HapticFeedback.selectionClick();
    setState(() {
      _index = i;
      _opened.add(i);
      if (i == 4) _compareVersion++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // Geri tuşu önce Keşfet'e döner, Keşfet'teyken uygulamadan çıkar.
      canPop: _index == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _select(0);
      },
      child: Scaffold(
        body: IndexedStack(
          index: _index,
          children: [
            for (var i = 0; i < _tabs.length; i++)
              _opened.contains(i) ? KeyedSubtree(key: ValueKey(i == 4 ? 'cmp$_compareVersion' : 'tab$i'), child: _build(i)) : const SizedBox.shrink(),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: _select,
          destinations: [
            for (final tab in _tabs)
              NavigationDestination(icon: Icon(tab.icon), selectedIcon: Icon(tab.selected), label: tab.label),
          ],
        ),
      ),
    );
  }
}
