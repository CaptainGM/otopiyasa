import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/screens/detail_screen.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/utils/tr_text.dart';

/// ANALİZ — web'deki `/analytics` sayfasının mobil karşılığı, aynı veriler:
///  - özet göstergeler, bütçe segmentleri, en çok ilanı olan markalar, yakıt/vites/kasa dağılımı, model yılı eğrisi
///    (`/api/analytics/overview`, sunucuda 6 saat önbellekli)
///  - marka + model seçip değer kaybı (amortisman) eğrisi, yıllık kayıp oranı, o yılın ilanları ve km/fiyat dağılımı
///    (`/api/analytics/model-breakdown`, web'deki InteractiveModelAnalytics ile aynı)
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

// Web'deki grafik renkleri (MarketInsightsCharts, InteractiveModelAnalytics).
const _bracketColors = [Color(0xFF38BDF8), Color(0xFF3B82F6), Color(0xFF6366F1), Color(0xFF8B5CF6), Color(0xFFEC4899)];
const _fuelColors = [
  Color(0xFF34D399),
  Color(0xFF38BDF8),
  Color(0xFFF59E0B),
  Color(0xFFA78BFA),
  Color(0xFFFB7185),
  Color(0xFF94A3B8),
];
const _brandColor = Color(0xFF10B981);
const _kmColor = Color(0xFF38BDF8);

final _money = NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0);
final _number = NumberFormat.decimalPattern('tr_TR');

/// Eksen etiketi için kısa fiyat: 1,6M / 450B.
String _compact(num value) {
  if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1).replaceAll('.', ',')}M';
  if (value >= 1000) return '${(value / 1000).round()}B';
  return value.round().toString();
}

int _int(Object? v) => (v as num?)?.toInt() ?? 0;

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  final _api = ApiService();
  late Future<Map<String, dynamic>> _overview;

  List<String> _brands = const [];
  Map<String, List<String>> _brandModels = const {};
  String _brand = '';
  String _model = '';
  Map<String, dynamic>? _modelData;
  bool _modelLoading = false;
  String? _modelError;
  int? _activeYear;

  @override
  void initState() {
    super.initState();
    _overview = _api.fetchAnalyticsOverview();
    _loadModelOptions();
  }

  Future<void> _loadModelOptions() async {
    try {
      final data = await _api.fetchModelBreakdown();
      final brands = (data['brands'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
      final raw = data['brandModels'] as Map<String, dynamic>? ?? {};
      final brandModels = raw.map((k, v) => MapEntry(k, (v as List<dynamic>).map((e) => e.toString()).toList()));
      if (!mounted) return;
      // Web ile aynı varsayılan: Renault Megane (yoksa ilk marka ve modeli).
      final brand = brands.contains('Renault') ? 'Renault' : (brands.isNotEmpty ? brands.first : '');
      final models = brandModels[brand] ?? const [];
      final model = models.contains('Megane') ? 'Megane' : (models.isNotEmpty ? models.first : '');
      setState(() {
        _brands = brands;
        _brandModels = brandModels;
        _brand = brand;
        _model = model;
      });
      await _loadModel();
    } catch (e) {
      if (mounted) setState(() => _modelError = e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _loadModel() async {
    if (_brand.isEmpty || _model.isEmpty) return;
    setState(() {
      _modelLoading = true;
      _modelError = null;
      _activeYear = null;
    });
    try {
      final data = await _api.fetchModelBreakdown(brand: _brand, model: _model);
      if (!mounted) return;
      final yearly = (data['yearlyData'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
      setState(() {
        _modelData = data;
        // En çok ilanı olan yıl seçili gelsin (o yılın ilanları hemen görünür).
        if (yearly.isNotEmpty) {
          yearly.sort((a, b) => _int(b['count']).compareTo(_int(a['count'])));
          _activeYear = _int(yearly.first['year']);
        }
      });
    } catch (e) {
      if (mounted) setState(() => _modelError = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _modelLoading = false);
    }
  }

  Future<String?> _pick(String title, List<String> options, String current) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _PickerSheet(title: title, options: options, current: current),
    );
  }

  Future<void> _refresh() async {
    setState(() => _overview = _api.fetchAnalyticsOverview());
    await Future.wait([_overview.then((_) {}, onError: (_) {}), _loadModel()]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Piyasa analizi')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<Map<String, dynamic>>(
          future: _overview,
          builder: (context, snapshot) {
            final data = snapshot.data;
            final insights = data?['insights'] as Map<String, dynamic>? ?? const {};
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
              children: [
                Text(
                  'Otomobil, SUV ve hafif ticari ilanlarıyla piyasa göstergeleri. Arşivdeki ilanlar katılmaz; veriler 6 saatte bir yenilenir.',
                  style: TextStyle(color: AppColors.of(context).muted, fontSize: 13, height: 1.4),
                ),
                const SizedBox(height: 16),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (snapshot.hasError || data == null)
                  _Panel(
                    child: Text(
                      snapshot.error?.toString().replaceFirst('Exception: ', '') ?? 'Analiz verileri yüklenemedi.',
                      style: TextStyle(color: AppColors.of(context).pricey),
                    ),
                  )
                else
                  _kpis(data, insights),
                const SizedBox(height: 16),
                _modelSection(),
                if (data != null) ...[
                  const SizedBox(height: 16),
                  _bracketsSection(insights),
                  const SizedBox(height: 16),
                  _brandsSection(insights),
                  const SizedBox(height: 16),
                  _fuelSection(insights),
                  const SizedBox(height: 16),
                  _barsSection(
                    eyebrow: 'Vites',
                    title: 'Vites türü tercihleri',
                    rows: (insights['transmissionStats'] as List<dynamic>? ?? [])
                        .whereType<Map<String, dynamic>>()
                        .toList(),
                    labelKey: 'transmission',
                    color: const Color(0xFFA78BFA),
                    base: (insights['featureBases'] as Map<String, dynamic>?)?['transmission'] as Map<String, dynamic>?,
                  ),
                  const SizedBox(height: 16),
                  _barsSection(
                    eyebrow: 'Kasa tipi',
                    title: 'Kasa tipi dağılımı',
                    rows: (insights['bodyTypeStats'] as List<dynamic>? ?? [])
                        .whereType<Map<String, dynamic>>()
                        .toList(),
                    labelKey: 'bodyType',
                    color: const Color(0xFFF59E0B),
                    base: (insights['featureBases'] as Map<String, dynamic>?)?['bodyType'] as Map<String, dynamic>?,
                  ),
                  const SizedBox(height: 16),
                  _yearSection(data),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  // ---------------------------------------------------------------- özet göstergeler

  Widget _kpis(Map<String, dynamic> data, Map<String, dynamic> insights) {
    final body = (insights['bodyTypeStats'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    final brackets =
        (insights['priceBrackets'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .where((b) => b['label'] != 'Diğer')
            .toList()
          ..sort((a, b) => _int(b['count']).compareTo(_int(a['count'])));
    final busiest = brackets.isNotEmpty ? brackets.first : null;
    final tiles = [
      _Kpi(
        label: 'Aktif ilan havuzu',
        value: _number.format(_int(data['totalCars'])),
        note: 'Yayındaki otomobil, SUV ve minivan',
        color: const Color(0xFF3B82F6),
      ),
      _Kpi(
        label: 'Ortalama fiyat',
        value: _money.format(_int(data['overallAvgPrice'])),
        note: 'Aşırı uç fiyatlar ayıklandı',
        color: AppColors.of(context).cheap,
      ),
      _Kpi(
        label: 'Lider kasa tipi',
        value: body.isNotEmpty ? body.first['bodyType'].toString() : '—',
        note: body.isNotEmpty ? 'Kasa tipi bilinenlerde %${body.first['sharePct']}' : 'Yeterli veri yok',
        color: AppTheme.accent,
      ),
      _Kpi(
        label: 'En yoğun bütçe',
        value: busiest?['label']?.toString() ?? '—',
        note: busiest != null ? 'İlanların %${busiest['sharePct']}\'i bu aralıkta' : 'Yeterli veri yok',
        color: const Color(0xFF818CF8),
      ),
    ];
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: tiles[0]),
            const SizedBox(width: 10),
            Expanded(child: tiles[1]),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: tiles[2]),
            const SizedBox(width: 10),
            Expanded(child: tiles[3]),
          ],
        ),
      ],
    );
  }

  // ---------------------------------------------------------------- model analizi

  Widget _modelSection() {
    final c = AppColors.of(context);
    final data = _modelData;
    final stats = data?['stats'] as Map<String, dynamic>?;
    final yearly = (data?['yearlyData'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList()
      ..sort((a, b) => _int(a['year']).compareTo(_int(b['year'])));
    final mileage = (data?['mileageData'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    final active = yearly.where((y) => _int(y['year']) == _activeYear).firstOrNull;

    return _Panel(
      accent: AppTheme.accent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Heading(eyebrow: 'Model analizi', title: 'Değer kaybı ve fiyat dağılımı'),
          const SizedBox(height: 4),
          Text(
            'Bir marka ve model seç: model yılına göre ortalama fiyatı, yıllık değer kaybını ve o yılın ilanlarını gör.',
            style: TextStyle(color: c.muted, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 12),
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
                          _loadModel();
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
                          _loadModel();
                        },
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (_modelLoading)
            const Padding(
              padding: EdgeInsets.all(28),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_modelError != null)
            Text(_modelError!, style: TextStyle(color: c.pricey))
          else if (data != null && yearly.isEmpty)
            Text('Bu model için aktif ilan bulunamadı.', style: TextStyle(color: c.muted))
          else if (data != null) ...[
            Row(
              children: [
                _MiniStat(label: 'Ortalama', value: _money.format(_int(stats?['overallAvgPrice']))),
                _MiniStat(
                  label: 'Yıllık değer kaybı',
                  value: '%${((stats?['annualDepreciationRate'] as num?) ?? 0).toString().replaceAll('.', ',')}',
                  color: c.pricey,
                ),
                _MiniStat(label: 'İlan', value: _number.format(_int(data['count']))),
              ],
            ),
            const SizedBox(height: 16),
            Text(trUpper('Model yılına göre ortalama fiyat'), style: AppText.eyebrow(context)),
            const SizedBox(height: 8),
            SizedBox(height: 210, child: _depreciationChart(yearly)),
            const SizedBox(height: 10),
            // Yıl seçimi: grafikte dokunmak yerine kaydırılabilir yıl çipleri (parmakla isabetli seçim).
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
                      onSelected: (_) {
                        HapticFeedback.selectionClick();
                        setState(() => _activeYear = _int(y['year']));
                      },
                    ),
                    const SizedBox(width: 6),
                  ],
                ],
              ),
            ),
            if (active != null) ...[const SizedBox(height: 12), _yearListings(active)],
            const SizedBox(height: 18),
            Text(trUpper('Kilometreye göre ortalama fiyat'), style: AppText.eyebrow(context)),
            const SizedBox(height: 8),
            SizedBox(height: 190, child: _mileageChart(mileage)),
          ],
        ],
      ),
    );
  }

  Widget _depreciationChart(List<Map<String, dynamic>> yearly) {
    final c = AppColors.of(context);
    final spots = [for (final y in yearly) FlSpot(_int(y['year']).toDouble(), _int(y['avgPrice']).toDouble())];
    final maxY = spots.map((s) => s.y).fold<double>(0, (a, b) => a > b ? a : b);
    return LineChart(
      LineChartData(
        minY: 0,
        maxY: maxY * 1.15,
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          getDrawingHorizontalLine: (_) => FlLine(color: c.border, strokeWidth: 1),
        ),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 40,
              getTitlesWidget: (value, meta) => Text(_compact(value), style: AppText.num(size: 10, color: c.muted)),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 24,
              interval: spots.length > 8 ? 3 : 1,
              getTitlesWidget: (value, meta) => Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  "'${(value.toInt() % 100).toString().padLeft(2, '0')}",
                  style: AppText.num(size: 10, color: c.muted),
                ),
              ),
            ),
          ),
        ),
        lineTouchData: LineTouchData(
          touchCallback: (event, response) {
            final spot = response?.lineBarSpots?.firstOrNull;
            if (event is FlTapUpEvent && spot != null) setState(() => _activeYear = spot.x.toInt());
          },
          touchTooltipData: LineTouchTooltipData(
            getTooltipColor: (_) => const Color(0xFF1F2228),
            getTooltipItems: (spots) => [
              for (final s in spots)
                LineTooltipItem(
                  '${s.x.toInt()}\n${_money.format(s.y)}',
                  AppText.num(size: 12, weight: FontWeight.w600, color: Colors.white),
                ),
            ],
          ),
        ),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            preventCurveOverShooting: true,
            color: AppTheme.accent,
            barWidth: 3,
            dotData: FlDotData(
              show: true,
              getDotPainter: (spot, _, _, _) => FlDotCirclePainter(
                radius: spot.x.toInt() == _activeYear ? 5.5 : 3,
                color: spot.x.toInt() == _activeYear ? Colors.white : AppTheme.accent,
                strokeWidth: spot.x.toInt() == _activeYear ? 3 : 0,
                strokeColor: AppTheme.accent,
              ),
            ),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [AppTheme.accent.withValues(alpha: 0.32), AppTheme.accent.withValues(alpha: 0.0)],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _yearListings(Map<String, dynamic> year) {
    final c = AppColors.of(context);
    final cars = (year['cars'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.accent.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.accent.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${year['year']} model $_brand $_model', style: AppText.display(size: 15, color: AppTheme.accent)),
          const SizedBox(height: 2),
          Text(
            'Ortalama ${_money.format(_int(year['avgPrice']))} · ${_money.format(_int(year['minPrice']))} – ${_money.format(_int(year['maxPrice']))} · ort. ${_number.format(_int(year['avgMileage']))} km',
            style: TextStyle(color: c.muted, fontSize: 12.5),
          ),
          const SizedBox(height: 8),
          for (final car in cars)
            InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => DetailScreen(carId: car['_id'].toString()))),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 7),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            car['title']?.toString() ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
                          ),
                          Text(
                            '${_number.format(_int(car['mileage']))} km${(car['city'] ?? '').toString().isNotEmpty ? ' · ${car['city']}' : ''}',
                            style: TextStyle(color: c.muted, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _money.format(_int(car['price'])),
                      style: AppText.num(size: 14, weight: FontWeight.w600, color: AppTheme.accent),
                    ),
                    Icon(Icons.chevron_right, size: 18, color: c.faint),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _mileageChart(List<Map<String, dynamic>> rows) {
    final c = AppColors.of(context);
    final maxY = rows.map((r) => _int(r['avgPrice'])).fold<int>(0, (a, b) => a > b ? a : b).toDouble();
    if (maxY <= 0) {
      return Center(child: Text('Yeterli veri yok', style: TextStyle(color: c.muted)));
    }
    return BarChart(
      BarChartData(
        maxY: maxY * 1.15,
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          getDrawingHorizontalLine: (_) => FlLine(color: c.border, strokeWidth: 1),
        ),
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
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 40,
              getTitlesWidget: (value, meta) => Text(_compact(value), style: AppText.num(size: 10, color: c.muted)),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 28,
              getTitlesWidget: (value, meta) {
                final i = value.toInt();
                if (i < 0 || i >= rows.length) return const SizedBox.shrink();
                final label = rows[i]['range'].toString().replaceAll(' km', '').replaceAll(' bin', 'B');
                return Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(label, style: TextStyle(fontSize: 10, color: c.muted)),
                );
              },
            ),
          ),
        ),
        barGroups: [
          for (var i = 0; i < rows.length; i++)
            BarChartGroupData(
              x: i,
              barRods: [
                BarChartRodData(
                  toY: _int(rows[i]['avgPrice']).toDouble(),
                  color: _kmColor,
                  width: 22,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                ),
              ],
            ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------- piyasa dağılımları

  Widget _bracketsSection(Map<String, dynamic> insights) {
    final c = AppColors.of(context);
    final rows = (insights['priceBrackets'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .where((b) => b['label'] != 'Diğer')
        .toList();
    if (rows.isEmpty) return const SizedBox.shrink();
    final maxY = rows.map((r) => _int(r['count'])).fold<int>(0, (a, b) => a > b ? a : b).toDouble();
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Heading(eyebrow: 'Bütçe', title: 'Bütçe segmentleri'),
          const SizedBox(height: 4),
          Text('Fiyat aralıklarına göre ilan sayısı ve pazar payı', style: TextStyle(color: c.muted, fontSize: 13)),
          const SizedBox(height: 14),
          SizedBox(
            height: 180,
            child: BarChart(
              BarChartData(
                maxY: maxY * 1.15,
                gridData: const FlGridData(show: false),
                borderData: FlBorderData(show: false),
                barTouchData: BarTouchData(enabled: false),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 26,
                      getTitlesWidget: (value, meta) {
                        final i = value.toInt();
                        if (i < 0 || i >= rows.length) return const SizedBox.shrink();
                        return Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            rows[i]['label'].toString().replaceAll(' ₺', ''),
                            style: TextStyle(fontSize: 10, color: c.muted),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                barGroups: [
                  for (var i = 0; i < rows.length; i++)
                    BarChartGroupData(
                      x: i,
                      barRods: [
                        BarChartRodData(
                          toY: _int(rows[i]['count']).toDouble(),
                          color: _bracketColors[i % _bracketColors.length],
                          width: 30,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (var i = 0; i < rows.length; i++)
                _Legend(
                  color: _bracketColors[i % _bracketColors.length],
                  label: rows[i]['label'].toString(),
                  value: '${_number.format(_int(rows[i]['count']))} · %${rows[i]['sharePct']}',
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _brandsSection(Map<String, dynamic> insights) {
    final c = AppColors.of(context);
    final rows = (insights['topBrands'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().take(10).toList();
    if (rows.isEmpty) return const SizedBox.shrink();
    final max = rows.map((r) => _int(r['count'])).fold<int>(1, (a, b) => a > b ? a : b);
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Heading(eyebrow: 'Markalar', title: 'En çok ilanı olan 10 marka'),
          const SizedBox(height: 12),
          for (final r in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          r['brand'].toString(),
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
                        ),
                      ),
                      Text('${_number.format(_int(r['count']))} ilan', style: AppText.num(size: 12, color: c.muted)),
                      const SizedBox(width: 10),
                      Text(_money.format(_int(r['avgPrice'])), style: AppText.num(size: 12.5, weight: FontWeight.w600)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: _int(r['count']) / max,
                      minHeight: 7,
                      color: _brandColor,
                      backgroundColor: c.border,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _fuelSection(Map<String, dynamic> insights) {
    final c = AppColors.of(context);
    final rows = (insights['fuelStats'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    final base = (insights['featureBases'] as Map<String, dynamic>?)?['fuelType'] as Map<String, dynamic>?;
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Heading(eyebrow: 'Yakıt', title: 'Yakıt türü dağılımı'),
          const SizedBox(height: 12),
          if (rows.isEmpty)
            _gatedNote(base)
          else
            Row(
              children: [
                SizedBox(
                  width: 130,
                  height: 130,
                  child: PieChart(
                    PieChartData(
                      centerSpaceRadius: 38,
                      sectionsSpace: 2,
                      sections: [
                        for (var i = 0; i < rows.length; i++)
                          PieChartSectionData(
                            value: _int(rows[i]['count']).toDouble(),
                            color: _fuelColors[i % _fuelColors.length],
                            radius: 24,
                            showTitle: false,
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (var i = 0; i < rows.length; i++)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            children: [
                              Container(
                                width: 10,
                                height: 10,
                                decoration: BoxDecoration(
                                  color: _fuelColors[i % _fuelColors.length],
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(child: Text(rows[i]['fuel'].toString(), style: const TextStyle(fontSize: 13.5))),
                              Text('%${rows[i]['sharePct']}', style: AppText.num(size: 13, weight: FontWeight.w600)),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          if (rows.isNotEmpty && base != null) ...[
            const SizedBox(height: 8),
            Text(
              'Yakıtı kaynaktan doğrulanmış ${_number.format(_int(base['trusted']))} ilana göre',
              style: TextStyle(color: c.muted, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }

  Widget _gatedNote(Map<String, dynamic>? base) {
    final c = AppColors.of(context);
    final trusted = _int(base?['trusted']);
    final total = _int(base?['total']);
    final pct = total > 0 ? (trusted * 100 / total).round() : 0;
    return Text(
      'Doğrulama sürüyor: aktif ilanlarda bu bilginin kaynaktan doğrulanma oranı %$pct. Güvenilir dağılım için oran yükseldikçe grafik kendiliğinden görünür.',
      style: TextStyle(color: c.muted, fontSize: 13, height: 1.4),
    );
  }

  Widget _barsSection({
    required String eyebrow,
    required String title,
    required List<Map<String, dynamic>> rows,
    required String labelKey,
    required Color color,
    Map<String, dynamic>? base,
  }) {
    final c = AppColors.of(context);
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Heading(eyebrow: eyebrow, title: title),
          const SizedBox(height: 12),
          if (rows.isEmpty)
            _gatedNote(base)
          else
            for (final r in rows)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            r[labelKey].toString(),
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
                          ),
                        ),
                        Text(
                          '%${r['sharePct']}',
                          style: AppText.num(size: 13, weight: FontWeight.w600, color: color),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'ort. ${_money.format(_int(r['avgPrice']))}',
                          style: AppText.num(size: 12, color: c.muted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: (_int(r['sharePct']) / 100).clamp(0.0, 1.0),
                        minHeight: 7,
                        color: color,
                        backgroundColor: c.border,
                      ),
                    ),
                  ],
                ),
              ),
        ],
      ),
    );
  }

  Widget _yearSection(Map<String, dynamic> data) {
    final c = AppColors.of(context);
    final rows =
        (data['byYear'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .where((r) => _int(r['year'] ?? r['_id']) >= DateTime.now().year - 20)
            .toList()
          ..sort((a, b) => _int(a['year'] ?? a['_id']).compareTo(_int(b['year'] ?? b['_id'])));
    if (rows.length < 2) return const SizedBox.shrink();
    final spots = [
      for (final r in rows) FlSpot(_int(r['year'] ?? r['_id']).toDouble(), _int(r['avgPrice']).toDouble()),
    ];
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Heading(eyebrow: 'Genel eğri', title: 'Model yılına göre ortalama fiyat'),
          const SizedBox(height: 4),
          Text('Son 20 model yılı, tüm markalar', style: TextStyle(color: c.muted, fontSize: 13)),
          const SizedBox(height: 14),
          SizedBox(
            height: 200,
            child: LineChart(
              LineChartData(
                minY: 0,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (_) => FlLine(color: c.border, strokeWidth: 1),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 40,
                      getTitlesWidget: (value, meta) =>
                          Text(_compact(value), style: AppText.num(size: 10, color: c.muted)),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 24,
                      interval: 4,
                      getTitlesWidget: (value, meta) => Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(value.toInt().toString(), style: AppText.num(size: 10, color: c.muted)),
                      ),
                    ),
                  ),
                ),
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipColor: (_) => const Color(0xFF1F2228),
                    getTooltipItems: (spots) => [
                      for (final s in spots)
                        LineTooltipItem(
                          '${s.x.toInt()}\n${_money.format(s.y)}',
                          AppText.num(size: 12, weight: FontWeight.w600, color: Colors.white),
                        ),
                    ],
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    preventCurveOverShooting: true,
                    color: AppColors.of(context).fair,
                    barWidth: 3,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          AppColors.of(context).fair.withValues(alpha: 0.28),
                          AppColors.of(context).fair.withValues(alpha: 0.0),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------- küçük parçalar

class _Panel extends StatelessWidget {
  const _Panel({required this.child, this.accent});

  final Widget child;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent?.withValues(alpha: 0.35) ?? c.border),
      ),
      child: child,
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading({required this.eyebrow, required this.title});

  final String eyebrow;
  final String title;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(trUpper(eyebrow), style: AppText.eyebrow(context)),
      const SizedBox(height: 2),
      Text(title, style: AppText.display(size: 18)),
    ],
  );
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
    // Renkli sol şerit ayrı çizilir: Flutter'da köşesi yuvarlak kutunun kenarları farklı renkte olamıyor.
    return Container(
      height: 112,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(width: 4, color: color),
          Expanded(
            child: Padding(padding: const EdgeInsets.fromLTRB(12, 12, 12, 12), child: _content(context, c)),
          ),
        ],
      ),
    );
  }

  Widget _content(BuildContext context, AppColors c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(trUpper(label), maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.eyebrow(context, size: 9.5)),
        const Spacer(),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            value,
            style: AppText.num(size: 21, weight: FontWeight.w600, color: color),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          note,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: c.muted, fontSize: 11.5, height: 1.25),
        ),
      ],
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value, this.color});

  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: c.muted, fontSize: 12)),
          const SizedBox(height: 2),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: AppText.num(
                size: 17,
                weight: FontWeight.w600,
                color: color ?? Theme.of(context).colorScheme.onSurface,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label, required this.value});

  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: c.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
          const SizedBox(width: 8),
          Text(value, style: AppText.num(size: 12, color: c.muted)),
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
        decoration: BoxDecoration(
          color: Theme.of(context).inputDecorationTheme.fillColor,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: c.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(color: c.muted, fontSize: 11.5)),
                  Text(
                    value.isEmpty ? '—' : value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                  ),
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
              TextField(
                autofocus: false,
                decoration: const InputDecoration(hintText: 'Ara…', prefixIcon: Icon(Icons.search)),
                onChanged: (v) => setState(() => _query = v),
              ),
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
