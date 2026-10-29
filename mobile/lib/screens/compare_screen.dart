import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/shell_tabs.dart';
import 'package:otopiyasa/utils/relative_time.dart';
import 'package:otopiyasa/widgets/compare_add_slot.dart';
import 'package:otopiyasa/widgets/listing_image.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Karşılaştırma listesi — cihazda saklanır (web'de de localStorage'da).
/// Giriş gerektirmez, bu yüzden sunucuda tutulmuyor.
class CompareStore {
  static const _key = 'compare_ids';
  static const maxItems = 4;

  static Future<List<String>> ids() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(_key) ?? [];
  }

  static Future<bool> contains(String carId) async => (await ids()).contains(carId);

  /// Ekli değilse ekler, ekliyse çıkarır. Yeni durumu (ekli mi) döner.
  static Future<bool> toggle(String carId) async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_key) ?? [];
    final wasThere = list.remove(carId);
    if (!wasThere) {
      if (list.length >= maxItems) return false; // sınır dolu
      list.add(carId);
    }
    await prefs.setStringList(_key, list);
    return !wasThere;
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

/// Tablodaki bir satır: kısa etiket, her araç için metin ve satırın vurgulanan sütunları.
class _CompareRow {
  const _CompareRow(
    this.label,
    this.values, {
    this.best = const {},
    this.worst = const {},
    this.warn = const {},
    this.isHeader = false,
    this.isBoolean = false,
    this.boolValues = const [],
    this.statuses = const [],
  });

  final String label;
  final List<String> values;

  /// En avantajlı değerin sütun numaraları (yeşil zemin).
  final Set<int> best;

  /// En dezavantajlı değerler (kırmızımsı yazı); yalnızca 3+ araçta ve sayısal satırlarda.
  final Set<int> worst;

  /// Dikkat çeken değerler (kırmızı, ör. hasar kaydı).
  final Set<int> warn;

  final bool isHeader;
  final bool isBoolean;
  final List<bool> boolValues;

  /// Donanım satırlarında her araç için 'var' | 'yok' | 'bilinmiyor' (ilan metninde hiç geçmiyor: "Yok" değildir).
  final List<String> statuses;

  /// Bütün araçlarda aynı mı? ("Sadece farkları göster" bunları gizler.)
  bool get allSame {
    if (isHeader) return false;
    if (isBoolean) {
      if (statuses.isNotEmpty) return statuses.toSet().length <= 1;
      return boolValues.toSet().length <= 1;
    }
    return values.toSet().length <= 1;
  }
}

/// Yalnızca internetten doğrulanmış değerler (specSource 'web') gösterilir; katalog ve tahmin değerleri kaynaksız olduğu için gizlenir.
TechnicalSpecs? _factorySpecs(CarListing c) => c.technicalSpecs?.specSource == 'web' ? c.technicalSpecs : null;

/// Donanım durumu: 'var' | 'yok' | 'bilinmiyor'. Eski yanıtta status yoksa yalnızca present'a bakılır.
String _equipmentStatus(CarListing c, String categoryId, String itemId) {
  final category = c.equipmentCategories.firstWhere(
    (ct) => ct.id == categoryId,
    orElse: () => const EquipmentCategory(id: '', title: '', items: []),
  );
  final found = category.items.firstWhere(
    (i) => i.id == itemId,
    orElse: () => const EquipmentItem(id: '', name: '', present: false),
  );
  return found.status ?? (found.present ? 'var' : 'yok');
}

/// KARŞILAŞTIRMA — web'deki `/compare` sayfasının mobil karşılığı.
///
/// 4 araç kaydırmadan aynı ekrana sığar: sütunlar ekran genişliğine bölünür, değerler kısa tutulur
/// (etiketler kısa, sayılar birimsiz, uzun tek kelimeler küçülür). Soldaki satır adları ve araç
/// başlıkları kaydırınca da görünür kalır. En iyi değer yeşil zeminle, en kötüsü kırmızımsı yazıyla
/// işaretlenir; "Sadece farklı olanlar" düğmesi herkeste aynı olan satırları gizler. Fotoğrafa ya da
/// başlığa dokunmak ilana götürür.
class CompareScreen extends StatefulWidget {
  const CompareScreen({super.key});

  @override
  State<CompareScreen> createState() => _CompareScreenState();
}

class _CompareScreenState extends State<CompareScreen> {
  static const _labelWidth = 72.0;
  static const _pagePadding = 8.0;
  static const _rowHeight = 44.0;
  static const _accent = Color(0xFFF5B942);

  final _api = ApiService();
  final _money = NumberFormat.decimalPattern('tr_TR');

  List<CarListing> _cars = [];
  bool _loading = true;
  String? _error;

  String? _aiSummary;
  bool _aiLoading = false;
  bool _aiExpanded = false;
  bool _diffOnly = false;

  // Aşağı kaydırınca fotoğraflar görünmez olur; o zaman üstte yapışan isim şeridi çıkar.
  final _vScroll = ScrollController();
  final _tableKey = GlobalKey();
  bool _showStrip = false;

  @override
  void initState() {
    super.initState();
    _vScroll.addListener(_updateStrip);
    _load();
  }

  @override
  void dispose() {
    _vScroll.dispose();
    super.dispose();
  }

  void _updateStrip() {
    final box = _tableKey.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.attached) return;
    final top = box.localToGlobal(Offset.zero).dy;
    final limit = MediaQuery.of(context).padding.top + kToolbarHeight;
    // Tablonun üst kenarı gövdenin üstüne çıktıysa fotoğraflar kısmen gizlenmiştir: isim şeridi çıkar.
    final show = top < limit - 24;
    if (show != _showStrip) setState(() => _showStrip = show);
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final ids = await CompareStore.ids();
      if (ids.isEmpty) {
        setState(() {
          _cars = [];
          _loading = false;
        });
        return;
      }
      final cars = await _api.compareCars(ids);
      if (!mounted) return;
      setState(() {
        _cars = cars;
        _loading = false;
      });
      if (cars.length >= 2) {
        _loadAiSummary(cars.map((c) => c.id).toList());
      } else {
        setState(() => _aiSummary = null);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _loadAiSummary(List<String> ids) async {
    setState(() {
      _aiLoading = true;
      _aiSummary = null;
    });
    final summary = await _api.compareSummary(ids).catchError((_) => null);
    if (!mounted) return;
    setState(() {
      _aiSummary = summary;
      _aiLoading = false;
    });
  }

  Future<void> _remove(CarListing car) async {
    await CompareStore.toggle(car.id);
    _load();
  }

  void _openCar(CarListing car) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => DetailScreen(carId: car.id, initialCar: car)),
    );
  }

  /// Boş kutu Keşfet'e götürür: araç ilan kartlarından eklenir. Karşılaştırma bir ilan detayından açıldıysa yığın
  /// kök ekrana (ana kabuk) kadar kapanır; sonra Keşfet sekmesi açılır.
  void _goToDiscover() {
    Navigator.of(context).popUntil((route) => route.isFirst);
    ShellTabs.request.value = ShellTabs.discover;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_cars.length >= 2 ? 'Karşılaştır (${_cars.length} araç)' : 'Karşılaştır'),
        actions: [
          if (_cars.isNotEmpty)
            IconButton(
              tooltip: 'Listeyi temizle',
              icon: const Icon(Icons.delete_sweep_outlined),
              onPressed: () async {
                await CompareStore.clear();
                _load();
              },
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!)))
              : _cars.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(32),
                        child: Text(
                          'Karşılaştırma listen boş.\n\nİlan detayında "Karşılaştır" '
                          'düğmesine basarak en fazla 4 araç ekleyebilirsin.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    )
                  : Stack(
                      children: [
                        ListView(
                          controller: _vScroll,
                          padding: const EdgeInsets.fromLTRB(_pagePadding, 8, _pagePadding, 24),
                          children: [
                            if (_cars.length >= 2) _aiSummaryCard(),
                            if (_cars.length >= 2) _diffToggle(),
                            _table(),
                            // Tek araçta bu yazı gereksiz: sağdaki kutu zaten "bir araç daha ekle" diyor.
                            if (_cars.length >= 2)
                              const Padding(
                                padding: EdgeInsets.symmetric(vertical: 12),
                                child: Text(
                                  'Yeşil zemin o satırda en avantajlı olanı gösterir. '
                                  '? ilan metninde belirtilmemiş demektir; Yok ise paket kuralından ya da ilanda açıkça yazılan olumsuz bir ifadeden gelir. '
                                  'Fotoğrafa dokunarak ilana gidebilirsin.',
                                  style: TextStyle(fontSize: 12, color: Colors.white54),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                          ],
                        ),
                        if (_showStrip) Positioned(top: 0, left: 0, right: 0, child: _stickyStrip()),
                      ],
                    ),
    );
  }

  /// Model yanıtındaki **kalın** işaretlerini gerçek kalın yazıya çevirir (ham yıldız görünmesin).
  List<InlineSpan> _summarySpans(String text) {
    final spans = <InlineSpan>[];
    final bold = RegExp(r'\*\*([^*]+)\*\*');
    var last = 0;
    for (final m in bold.allMatches(text)) {
      if (m.start > last) spans.add(TextSpan(text: text.substring(last, m.start).replaceAll('*', '')));
      spans.add(TextSpan(
        text: m.group(1),
        style: const TextStyle(fontWeight: FontWeight.w700, color: _accent),
      ));
      last = m.end;
    }
    if (last < text.length) spans.add(TextSpan(text: text.substring(last).replaceAll('*', '')));
    return spans;
  }

  /// Kısa görünür (4 satır), dokununca tamamı açılır: tablo ekranın üstünde kalsın, yazı yine büyük okunsun.
  Widget _aiSummaryCard() {
    if (!_aiLoading && (_aiSummary == null || _aiSummary!.isEmpty)) return const SizedBox.shrink();
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0x4DF5B942)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: _aiLoading ? null : () => setState(() => _aiExpanded = !_aiExpanded),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('AI Önerisi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: _accent)),
              const SizedBox(height: 8),
              if (_aiLoading)
                const Row(
                  children: [
                    SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                    SizedBox(width: 10),
                    Text('Araçlar analiz ediliyor…', style: TextStyle(fontSize: 14, color: Colors.white54)),
                  ],
                )
              else ...[
                Text.rich(
                  TextSpan(children: _summarySpans(_aiSummary ?? '')),
                  maxLines: _aiExpanded ? null : 4,
                  overflow: _aiExpanded ? TextOverflow.visible : TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 15.5, height: 1.5),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    _aiExpanded ? 'Daha az göster ▲' : 'Devamını oku ▼',
                    style: const TextStyle(fontSize: 12.5, color: _accent, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _diffToggle() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: FilterChip(
          label: const Text('Sadece farklı olanlar'),
          selected: _diffOnly,
          onSelected: (v) => setState(() => _diffOnly = v),
        ),
      ),
    );
  }

  Set<int> _extremes(List<num> input, {required bool lowest}) {
    // Çağıran List<int> verir; reduce'un (num, num) kapanışı çalışma anında uymaz, o yüzden List<num>'a kopyalanır.
    final values = List<num>.of(input);
    if (values.toSet().length <= 1) return {};
    final target = lowest ? values.reduce((a, b) => a < b ? a : b) : values.reduce((a, b) => a > b ? a : b);
    return {
      for (var i = 0; i < values.length; i++)
        if (values[i] == target) i,
    };
  }

  String _text(String value) => value.trim().isEmpty ? '-' : value.trim();

  /// Çekiş bilgisi kaynaktan "Önden Çekiş", "Arkadan İtiş", "4 Çeker (4WD)" gibi uzun yazılıyor.
  String _drivetrain(String raw) {
    final v = raw.toLowerCase();
    if (v.trim().isEmpty) return '-';
    if (v.contains('4x4') || v.contains('4wd') || v.contains('awd') || v.contains('dört') || v.contains('4 çeker')) return '4x4';
    if (v.contains('ön')) return 'Önden';
    if (v.contains('arka')) return 'Arkadan';
    return raw.trim();
  }

  List<_CompareRow> _rows() {
    final n = _cars.length;
    // Sayısal satırlarda en iyi/en kötü; 2 araçta "en kötü" zaten diğeri, ayrıca işaretlenmez.
    Set<int> worst(List<num> v, {required bool highest}) => n >= 3 ? _extremes(v, lowest: !highest) : {};

    String lastCheck(CarListing c) {
      final checked = c.lastVerifiedAt ?? c.createdAt;
      if (c.sourceSite == 'user' || !c.isActive || checked == null) return '-';
      return relativeTimeTr(checked);
    }

    final prices = [for (final c in _cars) c.price];
    final mileages = [for (final c in _cars) c.mileage];
    final years = [for (final c in _cars) c.year];

    final result = <_CompareRow>[];

    // --- BÖLÜM 1: GENEL BİLGİLER ---
    result.add(_CompareRow('📌 GENEL', [for (var i = 0; i < n; i++) ''], isHeader: true));
    result.addAll([
      _CompareRow('Fiyat ₺', [for (final c in _cars) _money.format(c.price)],
          best: _extremes(prices, lowest: true), worst: worst(prices, highest: true)),
      _CompareRow('Marka/model/yıl ort.', [
        for (final c in _cars)
          c.marketAvgPrice != null &&
                  c.marketAvgPrice! > 0 &&
                  (c.marketListingCount ?? 0) >= 3
              ? '${_money.format(c.marketAvgPrice)} · ${c.marketListingCount} ilan'
                  '${c.marketFamilyLabel != null ? ' (${c.marketFamilyLabel}, tüm donanımlar)' : ''}'
              : 'Yeterli veri yok (${c.marketListingCount ?? 0}/3)',
      ]),
      _CompareRow('Yıl', [for (final c in _cars) c.year.toString()],
          best: _extremes(years, lowest: false), worst: worst(years, highest: false)),
      _CompareRow('Km', [for (final c in _cars) _money.format(c.mileage)],
          best: _extremes(mileages, lowest: true), worst: worst(mileages, highest: true)),
      _CompareRow('Yakıt', [for (final c in _cars) _text(c.fuelType)]),
      _CompareRow('Vites', [for (final c in _cars) _text(c.transmission)]),
      _CompareRow('Kasa', [for (final c in _cars) _text(c.bodyType)]),
      _CompareRow('Renk', [for (final c in _cars) _text(c.color)]),
      _CompareRow('Motor', [for (final c in _cars) c.engineSize != null ? '${c.engineSize} L' : '-']),
      _CompareRow('Güç', [for (final c in _cars) c.horsepower != null ? '${c.horsepower} HP' : '-']),
      _CompareRow('Çekiş', [for (final c in _cars) _drivetrain(c.drivetrain)]),
      _CompareRow('Tüketim', [for (final c in _cars) _text(c.avgFuelConsumption)]),
      _CompareRow('Şehir', [for (final c in _cars) _text(c.city)]),
      _CompareRow('İlan tarihi', [for (final c in _cars) _text(c.listingDate)]),
      _CompareRow('Son kontrol', [for (final c in _cars) lastCheck(c)]),
      _CompareRow('Hasar', [for (final c in _cars) c.damageFlag ? 'Hasarlı' : 'Kayıt yok'],
          warn: {for (var i = 0; i < n; i++) if (_cars[i].damageFlag) i}),
    ]);

    // --- BÖLÜM 2: FABRİKA TEKNİK VERİLERİ ---
    final hasAnyTech = _cars.any((c) => _factorySpecs(c) != null);
    if (hasAnyTech) {
      final accs = [for (final c in _cars) _factorySpecs(c)?.acceleration ?? 99.0];
      final speeds = [for (final c in _cars) _factorySpecs(c)?.topSpeed ?? 0];
      final torques = [for (final c in _cars) _factorySpecs(c)?.torque ?? 0];
      final trunks = [for (final c in _cars) _factorySpecs(c)?.trunkCapacity ?? 0];

      result.add(_CompareRow('⚡ TEKNİK', [for (var i = 0; i < n; i++) ''], isHeader: true));
      result.addAll([
        _CompareRow(
          '0-100 km/s',
          [for (final c in _cars) _factorySpecs(c)?.acceleration != null ? '${_factorySpecs(c)!.acceleration} sn' : '-'],
          best: _extremes(accs, lowest: true),
          worst: worst(accs, highest: true),
        ),
        _CompareRow(
          'Azami Hız',
          [for (final c in _cars) _factorySpecs(c)?.topSpeed != null ? '${_factorySpecs(c)!.topSpeed} km/s' : '-'],
          best: _extremes(speeds, lowest: false),
          worst: worst(speeds, highest: false),
        ),
        _CompareRow(
          'Tork',
          [for (final c in _cars) _factorySpecs(c)?.torque != null ? '${_factorySpecs(c)!.torque} Nm' : '-'],
          best: _extremes(torques, lowest: false),
          worst: worst(torques, highest: false),
        ),
        _CompareRow(
          'Bagaj',
          [for (final c in _cars) _factorySpecs(c)?.trunkCapacity != null ? '${_factorySpecs(c)!.trunkCapacity} L' : '-'],
          best: _extremes(trunks, lowest: false),
          worst: worst(trunks, highest: false),
        ),
        _CompareRow(
          'Depo/Bat.',
          [for (final c in _cars) _text(_factorySpecs(c)?.fuelTank ?? '-')],
        ),
        _CompareRow(
          'Boş Ağırlık',
          [for (final c in _cars) _factorySpecs(c)?.curbWeight != null ? '${_factorySpecs(c)!.curbWeight} kg' : '-'],
        ),
      ]);
    }

    // --- BÖLÜM 3: DONANIM MATRİSİ ---
    final templateCats = _cars.isNotEmpty ? _cars.first.equipmentCategories : <EquipmentCategory>[];
    for (final cat in templateCats) {
      String catTitle = cat.title;
      if (cat.id == 'safety') {
        catTitle = '🛡️ GÜVENLİK';
      } else if (cat.id == 'comfort') {
        catTitle = '🛋️ KONFOR';
      } else if (cat.id == 'exterior') {
        catTitle = '🚗 DIŞ DONANIM';
      } else if (cat.id == 'multimedia') {
        catTitle = '📱 MULTİMEDYA';
      }

      result.add(_CompareRow(catTitle, [for (var i = 0; i < n; i++) ''], isHeader: true));

      for (final item in cat.items) {
        final statuses = [for (final c in _cars) _equipmentStatus(c, cat.id, item.id)];
        result.add(
          _CompareRow(
            item.name,
            [for (final s in statuses) s == 'var' ? 'Var' : (s == 'bilinmiyor' ? 'Belirtilmemiş' : 'Yok')],
            isBoolean: true,
            boolValues: [for (final s in statuses) s == 'var'],
            statuses: statuses,
          ),
        );
      }
    }

    return result;
  }

  /// Tek araçta yanına boş "araç ekle" sütunu gelir; sütun genişliği iki araçlık düzenle aynı kalsın diye iki sayılır.
  int get _slotCount => _cars.length == 1 ? 2 : _cars.length;

  double _columnWidth(double tableWidth) => (tableWidth - _labelWidth) / _slotCount;

  String _shortName(CarListing c) {
    final name = [c.brand, c.model].where((e) => e.trim().isNotEmpty).join(' ');
    return name.isEmpty ? c.title : name;
  }

  /// Tablo aşağı kaydırılınca üstte kalan kısa araç adları (sütunlarla hizalı).
  Widget _stickyStrip() {
    final columnWidth = _columnWidth(MediaQuery.of(context).size.width - _pagePadding * 2);
    return Material(
      color: Theme.of(context).scaffoldBackgroundColor,
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(_pagePadding + _labelWidth, 0, _pagePadding, 0),
        child: Row(
          children: [
            for (final car in _cars)
              GestureDetector(
                onTap: () => _openCar(car),
                behavior: HitTestBehavior.opaque,
                child: SizedBox(
                  width: columnWidth,
                  height: 40,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: Text(
                        _shortName(car),
                        maxLines: 2,
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11, height: 1.15, color: _accent),
                      ),
                    ),
                  ),
                ),
              ),
            if (_cars.length == 1) SizedBox(width: columnWidth, height: 40),
          ],
        ),
      ),
    );
  }

  /// Tek kelimelik değerler ("Kahramanmaraş", "15.950.000") sütuna sığmazsa küçülür; çok kelimeli olanlar 2 satıra sarar.
  Widget _cellText(String text, TextStyle style) {
    if (!text.contains(' ')) {
      return FittedBox(fit: BoxFit.scaleDown, child: Text(text, maxLines: 1, style: style));
    }
    return Text(text, maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: style.copyWith(height: 1.15));
  }

  Widget _table() {
    final allRows = _rows();
    List<_CompareRow> rows;
    if (_diffOnly && _cars.length >= 2) {
      final nonHeaderDiff = allRows.where((r) => !r.allSame).toList();
      final cleanRows = <_CompareRow>[];
      for (var i = 0; i < nonHeaderDiff.length; i++) {
        final current = nonHeaderDiff[i];
        if (current.isHeader) {
          final nextIsRow = i + 1 < nonHeaderDiff.length && !nonHeaderDiff[i + 1].isHeader;
          if (nextIsRow) cleanRows.add(current);
        } else {
          cleanRows.add(current);
        }
      }
      rows = cleanRows;
    } else {
      rows = allRows;
    }

    return LayoutBuilder(builder: (context, constraints) {
      final columnWidth = _columnWidth(constraints.maxWidth);
      final imageWidth = columnWidth - 6;
      final imageHeight = imageWidth * 0.72;
      final headerHeight = imageHeight + 4 + 30 + 6;
      final stripe = Colors.white.withValues(alpha: 0.04);
      const headerBg = Color(0xFF1E293B);

      Widget labelCell(int i) {
        final r = rows[i];
        if (r.isHeader) {
          return Container(
            height: 32,
            width: _labelWidth,
            alignment: Alignment.centerLeft,
            padding: const EdgeInsets.only(left: 4, right: 2),
            color: headerBg,
            child: Text(
              r.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: _accent, fontSize: 10, fontWeight: FontWeight.bold),
            ),
          );
        }
        return Container(
          height: _rowHeight,
          width: _labelWidth,
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.only(left: 4, right: 2),
          color: i.isOdd ? stripe : null,
          child: Text(
            r.label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Colors.white54, fontSize: 10.5, height: 1.15),
          ),
        );
      }

      Widget valueCell(int row, int col) {
        final r = rows[row];
        if (r.isHeader) {
          return Container(
            height: 32,
            width: columnWidth,
            color: headerBg,
          );
        }
        if (r.isBoolean && r.boolValues.length > col) {
          final present = r.boolValues[col];
          // İlan metninde hiç geçmeyen donanım "Yok" değildir: sütun dar olduğu için soru işaretli nötr rozet, açıklaması tablonun altında.
          final unknown = r.statuses.length > col && r.statuses[col] == 'bilinmiyor';
          final accent = present ? const Color(0xFF34D399) : (unknown ? Colors.white54 : const Color(0xFFF87171));
          final chip = Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
            decoration: BoxDecoration(
              color: present
                  ? const Color(0x2034D399)
                  : (unknown ? const Color(0x14FFFFFF) : const Color(0x18F87171)),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  present
                      ? Icons.check_circle_rounded
                      : (unknown ? Icons.help_outline_rounded : Icons.cancel_rounded),
                  size: 13,
                  color: accent,
                ),
                if (!unknown) ...[
                  const SizedBox(width: 3),
                  Text(
                    present ? 'Var' : 'Yok',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: present ? FontWeight.w700 : FontWeight.w500,
                      color: accent,
                    ),
                  ),
                ],
              ],
            ),
          );
          return Container(
            height: _rowHeight,
            width: columnWidth,
            color: row.isOdd ? stripe : null,
            padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
            child: Center(
              child: chip,
            ),
          );
        }
        final isBest = r.best.contains(col);
        final isWorst = r.worst.contains(col);
        final isWarn = r.warn.contains(col);
        final color = isBest
            ? Colors.greenAccent
            : (isWarn || isWorst ? const Color(0xFFFF8A80) : null);
        return Container(
          height: _rowHeight,
          width: columnWidth,
          color: row.isOdd ? stripe : null,
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
          child: Container(
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 3),
            decoration: isBest
                ? BoxDecoration(color: Colors.greenAccent.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(6))
                : null,
            child: _cellText(
              r.values[col],
              TextStyle(fontSize: 12.5, fontWeight: isBest ? FontWeight.w800 : FontWeight.w600, color: color),
            ),
          ),
        );
      }

      Widget header(CarListing car) => SizedBox(
            width: columnWidth,
            height: headerHeight,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: Column(
                children: [
                  Stack(
                    children: [
                      GestureDetector(
                        onTap: () => _openCar(car),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: SizedBox(
                            width: imageWidth,
                            height: imageHeight,
                            child: ListingImage(url: car.imageUrl, fallbacks: car.images, cacheWidth: 240),
                          ),
                        ),
                      ),
                      Positioned(
                        top: 0,
                        right: 0,
                        child: GestureDetector(
                          onTap: () => _remove(car),
                          behavior: HitTestBehavior.opaque,
                          child: Padding(
                            padding: const EdgeInsets.all(4),
                            child: Container(
                              width: 22,
                              height: 22,
                              decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                              child: const Icon(Icons.close, size: 14, color: Colors.white),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openCar(car),
                      behavior: HitTestBehavior.opaque,
                      child: Text(
                        _shortName(car),
                        maxLines: 2,
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5, height: 1.15),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );

      return Row(
        key: _tableKey,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Satır adları sütunu.
          Column(
            children: [
              SizedBox(width: _labelWidth, height: headerHeight),
              for (var i = 0; i < rows.length; i++) labelCell(i),
            ],
          ),
          for (var c = 0; c < _cars.length; c++)
            Column(
              children: [
                header(_cars[c]),
                for (var r = 0; r < rows.length; r++) valueCell(r, c),
              ],
            ),
          // Tek araçta sağdaki boş sütun: başlıkta kesikli kutu, altında boş hücreler (diğer sütunlarla hizalı).
          if (_cars.length == 1)
            Column(
              children: [
                CompareAddSlot(
                  width: columnWidth,
                  imageWidth: imageWidth,
                  imageHeight: imageHeight,
                  headerHeight: headerHeight,
                  onTap: _goToDiscover,
                ),
                for (var r = 0; r < rows.length; r++)
                  Container(
                    height: rows[r].isHeader ? 32 : _rowHeight,
                    width: columnWidth,
                    color: rows[r].isHeader ? headerBg : (r.isOdd ? stripe : null),
                  ),
              ],
            ),
        ],
      );
    });
  }
}
