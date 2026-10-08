import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/screens/search_results_screen.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/widgets/listing_image.dart';
import 'package:otopiyasa/utils/tr_text.dart';

/// DEĞER KAYBI — web'deki /deger-kaybi sayfasının karşılığı (aynı API: /api/analytics/model-breakdown).
/// Marka + model seçilir; hasar durumu ve kilometre aralığıyla süzülür. Etkiler (yaşın, 10 bin km'nin, hasarın, boyanın
/// fiyata etkisi) sunucuda log-fiyat regresyonuyla birlikte hesaplanır: her biri diğerlerinden arındırılmış.
class DegerKaybiScreen extends StatefulWidget {
  const DegerKaybiScreen({super.key});

  @override
  State<DegerKaybiScreen> createState() => _DegerKaybiScreenState();
}

const _clean = Color(0xFF34D399);
const _painted = Color(0xFFF2B544);
const _damaged = Color(0xFFF87171);

const _conditions = <(String, String, Color)>[
  ('', 'Tümü', Color(0xFF8F8D86)),
  ('clean', 'Hasarsız', _clean),
  ('painted', 'Boyalı / değişen', _painted),
  ('damaged', 'Hasar kayıtlı', _damaged),
];

const _kmRanges = <(String, int?, int?)>[
  ('Tüm km', null, null),
  ('0–50 bin', null, 50000),
  ('50–100 bin', 50000, 100000),
  ('100–150 bin', 100000, 150000),
  ('150 bin+', 150000, null),
];

final _money = NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0);
final _number = NumberFormat.decimalPattern('tr_TR');

String _compact(num value) {
  if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1).replaceAll('.', ',')}M';
  if (value >= 1000) return '${(value / 1000).round()}B';
  return value.round().toString();
}

int _int(Object? v) => (v as num?)?.toInt() ?? 0;

String _pct(num? v, {bool signed = false}) {
  if (v == null) return '—';
  final text = NumberFormat('#,##0.#', 'tr_TR').format(v.abs());
  return '${v < 0 ? '−' : (signed && v > 0 ? '+' : '')}%$text';
}

class _DegerKaybiScreenState extends State<DegerKaybiScreen> {
  final _api = ApiService();
  List<String> _brands = const [];
  Map<String, List<String>> _brandModels = const {};
  String _brand = '';
  String _model = '';
  String _condition = '';
  int _kmIndex = 0;
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;
  int? _activeYear;
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final data = await _api.fetchModelBreakdown();
      final brands = (data['brands'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
      final raw = data['brandModels'] as Map<String, dynamic>? ?? {};
      final brandModels = raw.map((k, v) => MapEntry(k, (v as List<dynamic>).map((e) => e.toString()).toList()));
      if (!mounted) return;
      final brand = brands.contains('Renault') ? 'Renault' : (brands.isNotEmpty ? brands.first : '');
      final models = brandModels[brand] ?? const [];
      setState(() {
        _brands = brands;
        _brandModels = brandModels;
        _brand = brand;
        _model = models.contains('Megane') ? 'Megane' : (models.isNotEmpty ? models.first : '');
      });
      await _load();
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
          _loading = false;
        });
      }
    }
  }

  Future<void> _load() async {
    if (_brand.isEmpty || _model.isEmpty) return;
    final id = ++_requestId;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final range = _kmRanges[_kmIndex];
      final data = await _api.fetchModelBreakdown(brand: _brand, model: _model, condition: _condition, kmMin: range.$2, kmMax: range.$3);
      if (!mounted || id != _requestId) return;
      final yearly = (data['yearlyData'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList()
        ..sort((a, b) => _int(b['count']).compareTo(_int(a['count'])));
      setState(() {
        _data = data;
        _activeYear = yearly.isEmpty ? null : _int(yearly.first['year']);
      });
    } catch (e) {
      if (mounted && id == _requestId) setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted && id == _requestId) setState(() => _loading = false);
    }
  }

  Future<String?> _pick(String title, List<String> options, String current) => showModalBottomSheet<String>(
        context: context,
        isScrollControlled: true,
        builder: (context) => _PickerSheet(title: title, options: options, current: current),
      );

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final data = _data;
    final count = _int(data?['count']);
    final effects = data?['effects'] as Map<String, dynamic>?;
    final counts = data?['conditionCounts'] as Map<String, dynamic>? ?? const {};
    final yearly = (data?['yearlyData'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList()
      ..sort((a, b) => _int(a['year']).compareTo(_int(b['year'])));
    final curves = (data?['conditionCurves'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    final mileage = (data?['mileageData'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    final active = yearly.where((y) => _int(y['year']) == _activeYear).firstOrNull;

    return Scaffold(
      appBar: AppBar(title: const Text('Değer kaybı')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
          children: [
            Text(
              'Fiyat yaşla, kilometreyle ve hasarla nasıl düşüyor? Her etki diğerlerinden ayrıştırılarak hesaplanır.',
              style: TextStyle(color: c.muted, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: _PickerButton(
                    label: 'Marka',
                    value: _brand,
                    onTap: _brands.isEmpty
                        ? null
                        : () async {
                            final picked = await _pick('Marka seç', _brands, _brand);
                            if (picked == null || picked == _brand) return;
                            final models = _brandModels[picked] ?? const [];
                            setState(() {
                              _brand = picked;
                              _model = models.isNotEmpty ? models.first : '';
                            });
                            _load();
                          },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _PickerButton(
                    label: 'Model',
                    value: _model,
                    onTap: (_brandModels[_brand] ?? const []).isEmpty
                        ? null
                        : () async {
                            final picked = await _pick('Model seç', _brandModels[_brand]!, _model);
                            if (picked == null || picked == _model) return;
                            setState(() => _model = picked);
                            _load();
                          },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text('HASAR DURUMU', style: AppText.eyebrow(context)),
            const SizedBox(height: 6),
            SizedBox(
              height: 38,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (final (key, label, color) in _conditions) ...[
                    ChoiceChip(
                      avatar: key.isEmpty ? null : Container(width: 9, height: 9, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                      label: Text(key.isEmpty ? label : '$label ${_int(counts[key])}'),
                      selected: _condition == key,
                      selectedColor: Theme.of(context).colorScheme.onSurface,
                      labelStyle: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: _condition == key ? Theme.of(context).scaffoldBackgroundColor : c.muted,
                      ),
                      onSelected: (_) {
                        HapticFeedback.selectionClick();
                        setState(() => _condition = key);
                        _load();
                      },
                    ),
                    const SizedBox(width: 8),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 10),
            Text('KİLOMETRE', style: AppText.eyebrow(context)),
            const SizedBox(height: 6),
            SizedBox(
              height: 38,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (var i = 0; i < _kmRanges.length; i++) ...[
                    ChoiceChip(
                      label: Text(_kmRanges[i].$1),
                      selected: _kmIndex == i,
                      selectedColor: Theme.of(context).colorScheme.onSurface,
                      labelStyle: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: _kmIndex == i ? Theme.of(context).scaffoldBackgroundColor : c.muted,
                      ),
                      onSelected: (_) {
                        HapticFeedback.selectionClick();
                        setState(() => _kmIndex = i);
                        _load();
                      },
                    ),
                    const SizedBox(width: 8),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (_loading && data == null)
              const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))
            else if (_error != null)
              Text(_error!, style: TextStyle(color: c.pricey))
            else if (data != null && count == 0)
              Padding(
                padding: const EdgeInsets.all(24),
                child: Text('Bu süzgeçlerle eşleşen ilan yok. Süzgeçleri gevşetmeyi dene.', style: TextStyle(color: c.muted), textAlign: TextAlign.center),
              )
            else if (data != null) ...[
              if (_loading) const LinearProgressIndicator(minHeight: 2),
              _kpiGrid(effects, c),
              const SizedBox(height: 6),
              Text(
                effects != null && _int(effects['sample']) >= 15
                    ? '${_number.format(_int(effects['sample']))} ilanın fiyatı yaş, km ve hasar durumuna birlikte bağlanarak hesaplandı (R² = ${effects['r2'] ?? '—'}). "—": o etki için yeterli ilan yok.'
                    : 'Etkileri güvenilir hesaplamak için bu süzgeçlerde yeterli ilan yok (en az 15).',
                style: TextStyle(color: c.muted, fontSize: 12, height: 1.4),
              ),
              const SizedBox(height: 18),
              _Panel(
                title: 'Değer kaybı eğrisi',
                subtitle: 'Model yılına göre ortalama fiyat; her çizgi bir hasar durumu.',
                child: Column(
                  children: [
                    SizedBox(height: 220, child: _curveChart(curves)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 14,
                      children: [
                        for (final (key, label, color) in _conditions)
                          if (key.isNotEmpty && (_condition.isEmpty || _condition == key))
                            Row(mainAxisSize: MainAxisSize.min, children: [
                              Container(width: 9, height: 9, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                              const SizedBox(width: 5),
                              Text(label, style: TextStyle(fontSize: 12, color: c.muted)),
                            ]),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              _Panel(
                title: 'Yıla göre ilanlar',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      height: 38,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          for (final y in yearly) ...[
                            ChoiceChip(
                              label: Text('${y['year']} · ${y['count']}'),
                              selected: _int(y['year']) == _activeYear,
                              selectedColor: AppTheme.accent,
                              labelStyle: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 12.5,
                                color: _int(y['year']) == _activeYear ? AppTheme.accentInk : c.muted,
                              ),
                              onSelected: (_) => setState(() => _activeYear = _int(y['year'])),
                            ),
                            const SizedBox(width: 6),
                          ],
                        ],
                      ),
                    ),
                    if (active != null) ...[
                      const SizedBox(height: 12),
                      Text('${active['year']} model $_brand $_model', style: AppText.display(size: 15, color: AppTheme.accent)),
                      const SizedBox(height: 2),
                      Text(
                        'Ortalama ${_money.format(_int(active['avgPrice']))} · ${_money.format(_int(active['minPrice']))} – ${_money.format(_int(active['maxPrice']))} · ort. ${_number.format(_int(active['avgMileage']))} km',
                        style: TextStyle(color: c.muted, fontSize: 12.5),
                      ),
                      const SizedBox(height: 6),
                      for (final car in (active['cars'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>())
                        InkWell(
                          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => DetailScreen(carId: car['_id'].toString()))),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 7),
                            child: Row(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: SizedBox(
                                    width: 64,
                                    height: 48,
                                    child: (car['imageUrl']?.toString() ?? '').isEmpty
                                        ? ColoredBox(color: c.border.withValues(alpha: 0.4))
                                        : ListingImage(url: car['imageUrl'].toString(), cacheWidth: 160),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(car['title']?.toString() ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                                      Text('${_number.format(_int(car['mileage']))} km${(car['city'] ?? '').toString().isNotEmpty ? ' · ${car['city']}' : ''}', style: TextStyle(color: c.muted, fontSize: 12)),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(_money.format(_int(car['price'])), style: AppText.num(size: 14, weight: FontWeight.w600, color: AppTheme.accent)),
                                Icon(Icons.chevron_right, size: 18, color: c.faint),
                              ],
                            ),
                          ),
                        ),
                      const SizedBox(height: 4),
                      OutlinedButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => SearchResultsScreen(
                              title: '${active['year']} $_brand $_model',
                              params: {'brand': _brand, 'model': _model, 'yearMin': '${active['year']}', 'yearMax': '${active['year']}'},
                            ),
                          ),
                        ),
                        child: Text('Tüm ${active['year']} ilanlarını gör'),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 14),
              _Panel(
                title: 'Kilometreye göre ortalama fiyat',
                subtitle: 'Seçili hasar durumu için.',
                child: SizedBox(height: 190, child: _mileageChart(mileage)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _kpiGrid(Map<String, dynamic>? e, AppColors c) {
    final tiles = <Widget>[
      _Kpi(label: 'Yaşın etkisi', value: _pct(e?['annualLossPct'] as num?), note: 'her ek yıl, aynı km ve durumda', color: AppTheme.accent),
      _Kpi(label: 'Pratikte yıllık', value: _pct(e?['typicalAnnualLossPct'] as num?), note: 'yaş + yılda ~15 bin km', color: AppTheme.accent),
      _Kpi(label: '10 bin km', value: _pct(e?['per10kKmLossPct'] as num?), note: 'aynı yaşta her 10.000 km', color: c.fair),
      _Kpi(label: 'Hasar kayıtlı', value: _pct(e?['damagePct'] as num?, signed: true), note: 'hasarsıza göre fiyat farkı', color: _damaged),
      _Kpi(label: 'Boyalı / değişen', value: _pct(e?['paintPct'] as num?, signed: true), note: 'hasarsıza göre fiyat farkı', color: _painted),
    ];
    return Column(
      children: [
        for (var i = 0; i < tiles.length; i += 2)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Expanded(child: tiles[i]),
                const SizedBox(width: 8),
                Expanded(child: i + 1 < tiles.length ? tiles[i + 1] : const SizedBox.shrink()),
              ],
            ),
          ),
      ],
    );
  }

  Widget _curveChart(List<Map<String, dynamic>> curves) {
    final c = AppColors.of(context);
    LineChartBarData series(String key, Color color) {
      final spots = [
        for (final p in curves)
          if (p[key] != null) FlSpot(_int(p['year']).toDouble(), (p[key] as num).toDouble()),
      ];
      return LineChartBarData(
        spots: spots,
        isCurved: true,
        preventCurveOverShooting: true,
        color: color,
        barWidth: 3,
        dotData: FlDotData(show: spots.length < 18),
      );
    }

    final bars = [
      for (final (key, _, color) in _conditions)
        if (key.isNotEmpty && (_condition.isEmpty || _condition == key)) series(key, color),
    ].where((b) => b.spots.length >= 2).toList();
    final allY = [for (final b in bars) ...b.spots.map((s) => s.y)];
    if (bars.isEmpty || allY.isEmpty) return Center(child: Text('Eğri için yeterli veri yok', style: TextStyle(color: c.muted)));
    final maxY = allY.reduce((a, b) => a > b ? a : b);
    return LineChart(
      LineChartData(
        minY: 0,
        maxY: maxY * 1.15,
        gridData: FlGridData(show: true, drawVerticalLine: false, getDrawingHorizontalLine: (_) => FlLine(color: c.border, strokeWidth: 1)),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(showTitles: true, reservedSize: 40, getTitlesWidget: (v, m) => Text(_compact(v), style: AppText.num(size: 10, color: c.muted))),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 24,
              interval: 4,
              getTitlesWidget: (v, m) => Padding(padding: const EdgeInsets.only(top: 6), child: Text("'${(v.toInt() % 100).toString().padLeft(2, '0')}", style: AppText.num(size: 10, color: c.muted))),
            ),
          ),
        ),
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipColor: (_) => const Color(0xFF1F2228),
            getTooltipItems: (spots) => [
              for (final s in spots) LineTooltipItem('${s.x.toInt()}\n${_money.format(s.y)}', AppText.num(size: 12, weight: FontWeight.w600, color: s.bar.color ?? Colors.white)),
            ],
          ),
        ),
        lineBarsData: bars,
      ),
    );
  }

  Widget _mileageChart(List<Map<String, dynamic>> rows) {
    final c = AppColors.of(context);
    final maxY = rows.map((r) => _int(r['avgPrice'])).fold<int>(0, (a, b) => a > b ? a : b).toDouble();
    if (maxY <= 0) return Center(child: Text('Yeterli veri yok', style: TextStyle(color: c.muted)));
    return BarChart(
      BarChartData(
        maxY: maxY * 1.15,
        gridData: FlGridData(show: true, drawVerticalLine: false, getDrawingHorizontalLine: (_) => FlLine(color: c.border, strokeWidth: 1)),
        borderData: FlBorderData(show: false),
        barTouchData: BarTouchData(
          touchTooltipData: BarTouchTooltipData(
            getTooltipColor: (_) => const Color(0xFF1F2228),
            getTooltipItem: (group, _, rod, _) => BarTooltipItem(
              '${rows[group.x]['range']}\n${_money.format(rod.toY)} · ${rows[group.x]['count']} ilan',
              AppText.num(size: 11.5, weight: FontWeight.w600, color: Colors.white),
            ),
          ),
        ),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(showTitles: true, reservedSize: 40, getTitlesWidget: (v, m) => Text(_compact(v), style: AppText.num(size: 10, color: c.muted))),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 28,
              getTitlesWidget: (value, meta) {
                final i = value.toInt();
                if (i < 0 || i >= rows.length) return const SizedBox.shrink();
                final label = rows[i]['range'].toString().replaceAll(' km', '').replaceAll(' bin', 'B');
                return Padding(padding: const EdgeInsets.only(top: 6), child: Text(label, style: TextStyle(fontSize: 10, color: c.muted)));
              },
            ),
          ),
        ),
        barGroups: [
          for (var i = 0; i < rows.length; i++)
            BarChartGroupData(x: i, barRods: [
              BarChartRodData(toY: _int(rows[i]['avgPrice']).toDouble(), color: const Color(0xFF38BDF8), width: 22, borderRadius: const BorderRadius.vertical(top: Radius.circular(6))),
            ]),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.title, required this.child, this.subtitle});

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Theme.of(context).cardTheme.color, borderRadius: BorderRadius.circular(16), border: Border.all(color: c.border)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppText.display(size: 17)),
          if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(subtitle!, style: TextStyle(color: c.muted, fontSize: 12.5))),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi({required this.label, required this.value, required this.note, required this.color});

  final String label;
  final String value;
  final String note;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Container(
      height: 104,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: Theme.of(context).cardTheme.color, borderRadius: BorderRadius.circular(14), border: Border.all(color: c.border)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(width: 4, color: color),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(trUpper(label), maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.eyebrow(context, size: 9.5)),
                  const Spacer(),
                  FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(value, style: AppText.num(size: 22, weight: FontWeight.w600, color: value == '—' ? c.faint : color))),
                  const SizedBox(height: 3),
                  Text(note, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: c.muted, fontSize: 11.5, height: 1.25)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PickerButton extends StatelessWidget {
  const _PickerButton({required this.label, required this.value, required this.onTap});

  final String label;
  final String value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: Theme.of(context).inputDecorationTheme.fillColor, borderRadius: BorderRadius.circular(10), border: Border.all(color: c.border)),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(color: c.muted, fontSize: 11.5)),
                  Text(value.isEmpty ? '—' : value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                ],
              ),
            ),
            Icon(Icons.expand_more, color: c.muted),
          ],
        ),
      ),
    );
  }
}

/// Aranabilir seçim listesi (marka/model).
class _PickerSheet extends StatefulWidget {
  const _PickerSheet({required this.title, required this.options, required this.current});

  final String title;
  final List<String> options;
  final String current;

  @override
  State<_PickerSheet> createState() => _PickerSheetState();
}

class _PickerSheetState extends State<_PickerSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final q = _query.trim().toLowerCase();
    final options = q.isEmpty ? widget.options : widget.options.where((o) => o.toLowerCase().contains(q)).toList();
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.75,
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.viewInsetsOf(context).bottom),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.title, style: AppText.display(size: 18)),
              const SizedBox(height: 10),
              TextField(decoration: const InputDecoration(hintText: 'Ara…', prefixIcon: Icon(Icons.search)), onChanged: (v) => setState(() => _query = v)),
              const SizedBox(height: 8),
              Expanded(
                child: ListView.builder(
                  itemCount: options.length,
                  itemBuilder: (context, i) {
                    final option = options[i];
                    final selected = option == widget.current;
                    return ListTile(
                      dense: true,
                      title: Text(option, style: TextStyle(fontWeight: selected ? FontWeight.w700 : FontWeight.w500)),
                      trailing: selected ? const Icon(Icons.check, color: AppTheme.accent) : null,
                      onTap: () => Navigator.of(context).pop(option),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
