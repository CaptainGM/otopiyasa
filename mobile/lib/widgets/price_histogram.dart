import 'package:flutter/material.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/theme/app_theme.dart';

/// "Bu araç piyasada nerede?" — web'deki PriceHistogram'ın karşılığı: segment (marka+model,
/// azsa yalnız marka) fiyat dağılımı, bu ilanın düştüğü dilim vurgulanır.
///
/// Her dilimin tüm sütunu dokunulabilir: kısa çubuklara da basılabilir. Seçili dilimin bilgisi
/// (aralık, ilan sayısı, pay) çubuğun altında sürekli görünür; ilk açılışta "Bu araç" dilimi seçili gelir.
class PriceHistogramChart extends StatefulWidget {
  const PriceHistogramChart({super.key, required this.bins, required this.segmentLabel});

  final List<PriceBin> bins;
  final String segmentLabel;

  @override
  State<PriceHistogramChart> createState() => _PriceHistogramChartState();
}

class _PriceHistogramChartState extends State<PriceHistogramChart> {
  static const _barAreaHeight = 110.0;
  static const _minBarHeight = 6.0;

  late int? _selected;

  @override
  void initState() {
    super.initState();
    _selected = _currentIndex();
  }

  @override
  void didUpdateWidget(covariant PriceHistogramChart oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.bins != widget.bins) _selected = _currentIndex();
  }

  int? _currentIndex() {
    final index = widget.bins.indexWhere((b) => b.isCurrent);
    return index < 0 ? null : index;
  }

  @override
  Widget build(BuildContext context) {
    final bins = widget.bins;
    if (bins.isEmpty) return const SizedBox.shrink();
    final maxCount = bins.map((b) => b.count).fold(0, (a, b) => a > b ? a : b);
    final total = bins.fold(0, (sum, b) => sum + b.count);
    final selected = _selected;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Bu araç piyasada nerede?', style: Theme.of(context).textTheme.titleMedium),
        Text(
          widget.segmentLabel,
          style: const TextStyle(fontSize: 11.5, color: Colors.white38),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: _barAreaHeight + 24,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (var i = 0; i < bins.length; i++)
                Expanded(
                  child: GestureDetector(
                    key: ValueKey('price-bin-$i'),
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() => _selected = i),
                    child: _bar(bins[i], maxCount: maxCount, isSelected: selected == i),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        if (selected != null) _detail(bins[selected], total),
      ],
    );
  }

  Widget _bar(PriceBin bin, {required int maxCount, required bool isSelected}) {
    final ratio = maxCount == 0 ? 0.0 : bin.count / maxCount;
    final height = bin.count == 0 ? 2.0 : (ratio * _barAreaHeight).clamp(_minBarHeight, _barAreaHeight);
    final color = bin.isCurrent
        ? AppTheme.accent
        : Colors.white.withValues(alpha: isSelected ? 0.4 : 0.14);
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          height: height,
          margin: const EdgeInsets.symmetric(horizontal: 3),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(4),
            border: isSelected ? Border.all(color: Colors.white, width: 1.5) : null,
          ),
        ),
        const SizedBox(height: 6),
        SizedBox(
          height: 14,
          child: Text(
            bin.isCurrent ? 'Bu araç' : '',
            maxLines: 1,
            overflow: TextOverflow.visible,
            softWrap: false,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.bold,
              color: AppTheme.accent,
            ),
          ),
        ),
      ],
    );
  }

  Widget _detail(PriceBin bin, int total) {
    final share = total == 0 ? 0 : (bin.count * 100 / total).round();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        '${bin.label}: ${bin.count} ilan (%$share)${bin.isCurrent ? ' · Bu araç bu aralıkta' : ''}',
        style: const TextStyle(fontSize: 12.5, color: Colors.white70),
      ),
    );
  }
}
