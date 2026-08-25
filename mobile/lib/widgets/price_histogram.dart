import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/theme/app_theme.dart';

/// "Bu araç piyasada nerede?" — web'deki PriceHistogram'ın aynısı: segment
/// (marka+model, azsa yalnız marka) fiyat dağılımı, bu ilanın düştüğü dilim
/// vurgulanır.
class PriceHistogramChart extends StatelessWidget {
  const PriceHistogramChart({super.key, required this.bins, required this.segmentLabel});

  final List<PriceBin> bins;
  final String segmentLabel;

  @override
  Widget build(BuildContext context) {
    if (bins.isEmpty) return const SizedBox.shrink();
    final maxCount = bins.map((b) => b.count).fold(0, (a, b) => a > b ? a : b);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Bu araç piyasada nerede?', style: Theme.of(context).textTheme.titleMedium),
        Text(
          segmentLabel,
          style: const TextStyle(fontSize: 11.5, color: Colors.white38),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 160,
          child: BarChart(
            BarChartData(
              maxY: (maxCount + 1).toDouble(),
              gridData: const FlGridData(show: false),
              borderData: FlBorderData(show: false),
              titlesData: FlTitlesData(
                leftTitles: const AxisTitles(),
                topTitles: const AxisTitles(),
                rightTitles: const AxisTitles(),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 30,
                    getTitlesWidget: (value, _) {
                      final index = value.toInt();
                      if (index < 0 || index >= bins.length) return const SizedBox();
                      return Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          bins[index].isCurrent ? 'Bu araç' : '',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: bins[index].isCurrent ? FontWeight.bold : FontWeight.normal,
                            color: bins[index].isCurrent ? AppTheme.accent : Colors.white38,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              barGroups: [
                for (var i = 0; i < bins.length; i++)
                  BarChartGroupData(
                    x: i,
                    barRods: [
                      BarChartRodData(
                        toY: bins[i].count.toDouble(),
                        color: bins[i].isCurrent ? AppTheme.accent : Colors.white.withValues(alpha: 0.12),
                        width: 18,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ],
                  ),
              ],
              barTouchData: BarTouchData(
                touchTooltipData: BarTouchTooltipData(
                  getTooltipItem: (group, groupIndex, rod, rodIndex) {
                    final bin = bins[group.x];
                    return BarTooltipItem(
                      '${bin.label}\n${bin.count} ilan',
                      const TextStyle(fontSize: 11, color: Colors.white),
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
