import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
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

  @override
  void initState() {
    super.initState();
    _overview = _api.fetchAnalyticsOverview();
  }

  Future<void> _refresh() async {
    setState(() => _overview = _api.fetchAnalyticsOverview());
    await _overview.then((_) {}, onError: (_) {});
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
  const _Panel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.border),
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
