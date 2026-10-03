import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/utils/relative_time.dart';
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
  });

  final String label;
  final List<String> values;

  /// En avantajlı değerin sütun numaraları (yeşil zemin).
  final Set<int> best;

  /// En dezavantajlı değerler (kırmızımsı yazı); yalnızca 3+ araçta ve sayısal satırlarda.
  final Set<int> worst;

  /// Dikkat çeken değerler (kırmızı, ör. hasar kaydı).
  final Set<int> warn;

  /// Bütün araçlarda aynı mı? ("Sadece farkları göster" bunları gizler.)
  bool get allSame => values.toSet().length <= 1;
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
  static const _labelWidth = 58.0;
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
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: Text(
                                _cars.length < 2
                                    ? 'Karşılaştırmak için en az bir araç daha ekle.'
                                    : 'Yeşil zemin o satırda en avantajlı olanı gösterir. '
                                        'Fotoğrafa dokunarak ilana gidebilirsin.',
                                style: const TextStyle(fontSize: 12, color: Colors.white54),
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
              const Text('🤖 AI Önerisi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: _accent)),
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

    return [
      _CompareRow('Fiyat ₺', [for (final c in _cars) _money.format(c.price)],
          best: _extremes(prices, lowest: true), worst: worst(prices, highest: true)),
      _CompareRow('Piyasa ort. ₺', [for (final c in _cars) c.marketAvgPrice != null ? _money.format(c.marketAvgPrice) : '-']),
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
    ];
  }

  double _columnWidth(double tableWidth) => (tableWidth - _labelWidth) / _cars.length;

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
    final rows = _diffOnly && _cars.length >= 2 ? allRows.where((r) => !r.allSame).toList() : allRows;

    return LayoutBuilder(builder: (context, constraints) {
      final columnWidth = _columnWidth(constraints.maxWidth);
      final imageWidth = columnWidth - 6;
      final imageHeight = imageWidth * 0.72;
      final headerHeight = imageHeight + 4 + 30 + 6;
      final stripe = Colors.white.withValues(alpha: 0.04);

      Widget labelCell(int i) => Container(
            height: _rowHeight,
            width: _labelWidth,
            alignment: Alignment.centerLeft,
            padding: const EdgeInsets.only(left: 4, right: 2),
            color: i.isOdd ? stripe : null,
            child: Text(rows[i].label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white54, fontSize: 11, height: 1.15)),
          );

      Widget valueCell(int row, int col) {
        final r = rows[row];
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
        ],
      );
    });
  }
}
