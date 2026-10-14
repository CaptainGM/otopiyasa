import 'package:flutter/foundation.dart';

/// Alt gezinme sekmesini başka bir ekrandan açmak için. Karşılaştırmadaki boş araç kutusu buradan Keşfet'e götürür.
/// Kabuk (MainShell) bu değeri dinler; değer verilince o sekmeye geçer ve değeri boşaltır.
class ShellTabs {
  /// Keşfet sekmesinin indeksi.
  static const discover = 0;

  static final request = ValueNotifier<int?>(null);
}
