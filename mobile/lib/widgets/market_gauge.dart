import 'package:flutter/material.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/utils/market_position.dart';
import 'package:otopiyasa/utils/tr_text.dart';

/// Fiyatın kendi segmentindeki yeri: ucuz (nane) → adil (buz mavisi) → pahalı (mercan) çubuğu üzerinde ibre.
/// Web'deki MarketGauge ile aynı (sitenin imza öğesi). Emsal yetersizse ince "piyasa verisi az" satırı çizilir.
class MarketGauge extends StatelessWidget {
  const MarketGauge({super.key, required this.price, this.avg, this.count, this.large = false});

  final int price;
  final int? avg;
  final int? count;
  final bool large;

  static Color bandColor(BuildContext context, MarketBand band) {
    final c = AppColors.of(context);
    switch (band) {
      case MarketBand.suspicious:
        return AppTheme.accent;
      case MarketBand.cheap:
        return c.cheap;
      case MarketBand.fair:
        return c.fair;
      case MarketBand.pricey:
        return c.pricey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final position = MarketPosition.of(price, avg, count);
    final labelSize = large ? 11.5 : 10.0;
    if (position == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(height: 3, decoration: BoxDecoration(color: c.border, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 6),
          Text('PİYASA VERİSİ AZ', style: AppText.eyebrow(context, color: c.faint, size: labelSize - 0.5)),
        ],
      );
    }
    final color = bandColor(context, position.band);
    final cardColor = Theme.of(context).cardTheme.color ?? Theme.of(context).colorScheme.surface;
    return Semantics(
      label: 'Piyasaya göre: ${position.label}, $count benzer ilan',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: 10,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final x = constraints.maxWidth * position.marker;
                return Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(
                      left: 0,
                      right: 0,
                      top: 3.5,
                      child: Container(
                        height: 3,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(2),
                          gradient: LinearGradient(colors: [c.cheap, c.fair, c.pricey]),
                        ),
                      ),
                    ),
                    Positioned(
                      left: x - 5,
                      top: 0,
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Theme.of(context).colorScheme.onSurface,
                          border: Border.all(color: cardColor, width: 2.5),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
          const SizedBox(height: 5),
          Row(
            children: [
              Expanded(
                child: Text(
                  trUpper(position.label),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.num(size: labelSize, weight: FontWeight.w600, color: color).copyWith(letterSpacing: 0.6),
                ),
              ),
              Text('$count emsal', style: AppText.num(size: labelSize, color: c.faint)),
            ],
          ),
        ],
      ),
    );
  }
}
