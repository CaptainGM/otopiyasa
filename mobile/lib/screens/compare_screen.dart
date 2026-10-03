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

/// Tablodaki bir satır: etiket, her araç için metin ve (varsa) o satırda en iyi olan araçlar.
class _CompareRow {
  const _CompareRow(this.label, this.values, {this.best = const {}, this.warn = const {}});

  final String label;
  final List<String> values;

  /// En avantajlı değerin sütun numaraları (yeşil).
  final Set<int> best;

  /// Dikkat çeken değerlerin sütun numaraları (kırmızı, ör. hasar kaydı).
  final Set<int> warn;
}

/// KARŞILAŞTIRMA — web'deki `/compare` sayfasının mobil karşılığı.
/// Araçlar yan yana sütunlarda; soldaki etiket sütunu sabit, sütunlar yatay kaydırılır
/// (2 araç ekrana sığar, 3-4 araçta kaydırılır). Fotoğrafa ya da başlığa dokunmak ilana götürür.
class CompareScreen extends StatefulWidget {
  const CompareScreen({super.key});

  @override
  State<CompareScreen> createState() => _CompareScreenState();
}

class _CompareScreenState extends State<CompareScreen> {
  static const _labelWidth = 92.0;
  static const _minColumnWidth = 150.0;
  static const _headerHeight = 196.0;
  static const _rowHeight = 46.0;

  final _api = ApiService();
  final _money = NumberFormat.decimalPattern('tr_TR');

  List<CarListing> _cars = [];
  bool _loading = true;
  String? _error;

  String? _aiSummary;
  bool _aiLoading = false;
  bool _aiOpen = true;

  // Aşağı kaydırınca büyük araç başlıkları görünmez olur; o zaman üstte yapışan isim şeridi çıkar.
  final _vScroll = ScrollController();
  final _hScroll = ScrollController();
  final _stripScroll = ScrollController();
  final _tableKey = GlobalKey();
  bool _showStrip = false;

  @override
  void initState() {
    super.initState();
    _vScroll.addListener(_updateStrip);
    // Şerit tablonun yatay kaydırmasını izler (parmakla kaydırılmaz, yalnızca eşlenir).
    _hScroll.addListener(() {
      if (_stripScroll.hasClients && _stripScroll.offset != _hScroll.offset) {
        _stripScroll.jumpTo(_hScroll.offset.clamp(0.0, _stripScroll.position.maxScrollExtent));
      }
    });
    _load();
  }

  @override
  void dispose() {
    _vScroll.dispose();
    _hScroll.dispose();
    _stripScroll.dispose();
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
                  : _cars.length < 2
                      ? ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            _table(),
                            const Padding(
                              padding: EdgeInsets.all(16),
                              child: Text(
                                'Karşılaştırmak için en az bir araç daha ekle.',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Colors.white54),
                              ),
                            ),
                          ],
                        )
                      : Stack(
                          children: [
                            ListView(
                              controller: _vScroll,
                              padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                              children: [
                                _aiSummaryCard(),
                                _table(),
                                const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 12),
                                  child: Text(
                                    'Yeşil işaretli değerler o satırda en avantajlı olanı gösterir. '
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
        style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFF5B942)),
      ));
      last = m.end;
    }
    if (last < text.length) spans.add(TextSpan(text: text.substring(last).replaceAll('*', '')));
    return spans;
  }

  Widget _aiSummaryCard() {
    if (!_aiLoading && (_aiSummary == null || _aiSummary!.isEmpty)) return const SizedBox.shrink();
    if (!_aiOpen) {
      return Align(
        alignment: Alignment.centerLeft,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: OutlinedButton.icon(
            onPressed: () => setState(() => _aiOpen = true),
            icon: const Text('🤖'),
            label: const Text('AI Önerisi'),
          ),
        ),
      );
    }
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0x4DF5B942)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('🤖 AI Önerisi',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFFF5B942))),
                IconButton(
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  iconSize: 22,
                  tooltip: 'Gizle',
                  onPressed: () => setState(() => _aiOpen = false),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (_aiLoading)
              const Row(
                children: [
                  SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                  SizedBox(width: 10),
                  Text('Araçlar analiz ediliyor…', style: TextStyle(fontSize: 14, color: Colors.white54)),
                ],
              )
            else
              Text.rich(
                TextSpan(children: _summarySpans(_aiSummary ?? '')),
                style: const TextStyle(fontSize: 15.5, height: 1.55),
              ),
          ],
        ),
      ),
    );
  }

  Set<int> _bestIndexes(List<num> values, {required bool lowest}) {
    if (values.isEmpty) return {};
    final target = lowest ? values.reduce((a, b) => a < b ? a : b) : values.reduce((a, b) => a > b ? a : b);
    return {
      for (var i = 0; i < values.length; i++)
        if (values[i] == target) i,
    };
  }

  String _text(String value) => value.trim().isEmpty ? '-' : value;

  List<_CompareRow> _rows() {
    final n = _cars.length;
    // En iyi vurgusu yalnızca birden fazla farklı değer varken anlamlı; hepsi aynıysa işaretlenmez.
    Set<int> best(List<num> v, {required bool lowest}) => v.toSet().length > 1 ? _bestIndexes(v, lowest: lowest) : {};

    String lastCheck(CarListing c) {
      final checked = c.lastVerifiedAt ?? c.createdAt;
      if (c.sourceSite == 'user' || !c.isActive || checked == null) return '-';
      return relativeTimeTr(checked);
    }

    return [
      _CompareRow('Fiyat', [for (final c in _cars) '${_money.format(c.price)} ₺'],
          best: best([for (final c in _cars) c.price], lowest: true)),
      _CompareRow('Canlı piyasa ort.', [for (final c in _cars) c.marketAvgPrice != null ? '${_money.format(c.marketAvgPrice)} ₺' : '-']),
      _CompareRow('Yıl', [for (final c in _cars) c.year.toString()], best: best([for (final c in _cars) c.year], lowest: false)),
      _CompareRow('Kilometre', [for (final c in _cars) '${_money.format(c.mileage)} km'],
          best: best([for (final c in _cars) c.mileage], lowest: true)),
      _CompareRow('Yakıt', [for (final c in _cars) _text(c.fuelType)]),
      _CompareRow('Vites', [for (final c in _cars) _text(c.transmission)]),
      _CompareRow('Kasa', [for (final c in _cars) _text(c.bodyType)]),
      _CompareRow('Renk', [for (final c in _cars) _text(c.color)]),
      _CompareRow('Motor', [for (final c in _cars) c.engineSize != null ? '${c.engineSize} L' : '-']),
      _CompareRow('Güç', [for (final c in _cars) c.horsepower != null ? '${c.horsepower} HP' : '-']),
      _CompareRow('Çekiş', [for (final c in _cars) _text(c.drivetrain)]),
      _CompareRow('Ort. tüketim', [for (final c in _cars) _text(c.avgFuelConsumption)]),
      _CompareRow('Şehir', [for (final c in _cars) _text(c.city)]),
      _CompareRow('İlan tarihi', [for (final c in _cars) _text(c.listingDate)]),
      _CompareRow('Son kontrol', [for (final c in _cars) lastCheck(c)]),
      _CompareRow('Hasar', [for (final c in _cars) c.damageFlag ? 'Hasar kaydı' : 'Belirtilmemiş'],
          warn: {for (var i = 0; i < n; i++) if (_cars[i].damageFlag) i}),
    ];
  }

  /// 2 araç ekrana tam sığar; 3-4 araçta her sütun en az 150 px olup yatay kaydırılır.
  double _columnWidth(double tableWidth) =>
      ((tableWidth - _labelWidth) / _cars.length).clamp(_minColumnWidth, 260.0).toDouble();

  /// Tablo aşağı kaydırılınca üstte kalan kısa araç adları (sütunlarla hizalı).
  Widget _stickyStrip() {
    final columnWidth = _columnWidth(MediaQuery.of(context).size.width - 24);
    return Material(
      color: Theme.of(context).scaffoldBackgroundColor,
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12 + _labelWidth, 0, 12, 0),
        child: SingleChildScrollView(
          controller: _stripScroll,
          scrollDirection: Axis.horizontal,
          physics: const NeverScrollableScrollPhysics(),
          child: Row(
            children: [
              for (final car in _cars)
                GestureDetector(
                  onTap: () => _openCar(car),
                  child: SizedBox(
                    width: columnWidth,
                    height: 40,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          [car.brand, car.model].where((e) => e.trim().isNotEmpty).join(' '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFFF5B942)),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _table() {
    final rows = _rows();
    return LayoutBuilder(builder: (context, constraints) {
      final columnWidth = _columnWidth(constraints.maxWidth);
      final stripe = Colors.white.withValues(alpha: 0.04);

      Widget labelCell(int i) => Container(
            height: _rowHeight,
            width: _labelWidth,
            alignment: Alignment.centerLeft,
            padding: const EdgeInsets.only(left: 6, right: 4),
            color: i.isOdd ? stripe : null,
            child: Text(rows[i].label, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white54, fontSize: 12.5)),
          );

      Widget valueCell(int row, int col) {
        final r = rows[row];
        final isBest = r.best.contains(col);
        final isWarn = r.warn.contains(col);
        final color = isBest ? Colors.greenAccent : (isWarn ? Colors.redAccent : null);
        return Container(
          height: _rowHeight,
          width: columnWidth,
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          color: row.isOdd ? stripe : null,
          child: Row(
            children: [
              if (isBest)
                const Padding(
                  padding: EdgeInsets.only(right: 4),
                  child: Icon(Icons.check_circle, size: 15, color: Colors.greenAccent),
                ),
              Expanded(
                child: Text(
                  r.values[col],
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, fontWeight: isBest ? FontWeight.w800 : FontWeight.w500, color: color),
                ),
              ),
            ],
          ),
        );
      }

      Widget header(CarListing car) => SizedBox(
            width: columnWidth,
            height: _headerHeight,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 4, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  GestureDetector(
                    onTap: () => _openCar(car),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: AspectRatio(
                        aspectRatio: 16 / 10,
                        child: ListingImage(url: car.imageUrl, fallbacks: car.images, cacheWidth: 360),
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _openCar(car),
                      child: Text(car.title,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, height: 1.25)),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => _remove(car),
                    behavior: HitTestBehavior.opaque,
                    child: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 2),
                      child: Text('Çıkar', style: TextStyle(fontSize: 12, color: Colors.white54)),
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
          // Sabit etiket sütunu: yatay kaydırılsa da satır adları görünür kalır.
          Column(
            children: [
              const SizedBox(width: _labelWidth, height: _headerHeight),
              for (var i = 0; i < rows.length; i++) labelCell(i),
            ],
          ),
          Expanded(
            child: SingleChildScrollView(
              controller: _hScroll,
              scrollDirection: Axis.horizontal,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var c = 0; c < _cars.length; c++)
                    Column(
                      children: [
                        header(_cars[c]),
                        for (var r = 0; r < rows.length; r++) valueCell(r, c),
                      ],
                    ),
                ],
              ),
            ),
          ),
        ],
      );
    });
  }
}
