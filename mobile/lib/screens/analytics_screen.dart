import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/services/api_service.dart';

/// ANALİZ — web'deki `/analytics` sayfasının mobil karşılığı.
///
/// Aynı `/api/stats` uç noktası: markaya göre ortalama fiyat ve model yılına
/// göre ortalama fiyat. Grafik verisi sunucuda hesaplanıyor.
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  final _api = ApiService();
  final _money = NumberFormat.decimalPattern('tr_TR');

  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _api.fetchStats();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Analiz')),
      body: RefreshIndicator(
        onRefresh: () async => setState(() => _future = _api.fetchStats()),
        child: FutureBuilder<Map<String, dynamic>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ListView(children: [
                Padding(
                  padding: const EdgeInsets.all(32),
                  child: Text(snapshot.error.toString().replaceFirst('Exception: ', '')),
                ),
              ]);
            }

            final data = snapshot.data ?? {};
            final byBrand = (data['byBrand'] as List<dynamic>? ?? [])
                .whereType<Map<String, dynamic>>()
                .toList();
            final byYear = (data['byYear'] as List<dynamic>? ?? [])
                .whereType<Map<String, dynamic>>()
                .toList();
            final total = (data['totalCars'] as num?)?.toInt() ?? 0;

            // İlan sayısı en yüksek 10 marka (fiyat sırası değil — okunabilirlik)
            final topBrands = [...byBrand]
              ..sort((a, b) =>
                  ((b['count'] as num?) ?? 0).compareTo((a['count'] as num?) ?? 0));
            final brands = topBrands.take(10).toList();

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.directions_car),
                    title: Text('${_money.format(total)} ilan'),
                    subtitle: Text('${byBrand.length} marka'),
                  ),
                ),
                const SizedBox(height: 20),

                const Text('Markaya göre ortalama fiyat',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                const Text('İlan sayısı en yüksek 10 marka',
                    style: TextStyle(fontSize: 12, color: Colors.white54)),
                const SizedBox(height: 12),
                ...brands.map((b) {
                  final avg = (b['avgPrice'] as num?)?.toInt() ?? 0;
                  final count = (b['count'] as num?)?.toInt() ?? 0;
                  return ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(b['brand']?.toString() ?? ''),
                    subtitle: Text('$count ilan'),
                    trailing: Text('${_money.format(avg)} ₺',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                  );
                }),

                const SizedBox(height: 24),
                const Text('Model yılına göre ortalama fiyat',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
                SizedBox(height: 240, child: _yearChart(byYear)),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _yearChart(List<Map<String, dynamic>> byYear) {
    // Çok eski/az örnekli yıllar grafiği bozuyor; son 20 yıl gösteriliyor.
    final rows = byYear
        .where((r) => ((r['year'] as num?)?.toInt() ?? 0) >= DateTime.now().year - 20)
        .toList()
      ..sort((a, b) =>
          ((a['year'] as num?) ?? 0).compareTo((b['year'] as num?) ?? 0));

    if (rows.length < 2) {
      return const Center(child: Text('Grafik için yeterli veri yok'));
    }

    final spots = [
      for (var i = 0; i < rows.length; i++)
        FlSpot(
          ((rows[i]['year'] as num?) ?? 0).toDouble(),
          ((rows[i]['avgPrice'] as num?) ?? 0).toDouble(),
        ),
    ];

    return LineChart(
      LineChartData(
        gridData: const FlGridData(show: true, drawVerticalLine: false),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 46,
              getTitlesWidget: (value, meta) => Text(
                '${(value / 1000000).toStringAsFixed(1)}M',
                style: const TextStyle(fontSize: 10, color: Colors.white54),
              ),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              interval: 5,
              getTitlesWidget: (value, meta) => Text(
                value.toInt().toString(),
                style: const TextStyle(fontSize: 10, color: Colors.white54),
              ),
            ),
          ),
        ),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            curveSmoothness: 0.25,
            barWidth: 3,
            color: const Color(0xFFEAB24A),
            dotData: const FlDotData(show: false),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  const Color(0xFFEAB24A).withValues(alpha: 0.25),
                  const Color(0xFFEAB24A).withValues(alpha: 0.0),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
