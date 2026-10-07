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
        return Theme.of(context).colorScheme.error;
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
    final labelSize = large ? 13.0 : 11.0;
    if (position == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(height: 5, decoration: BoxDecoration(color: c.border, borderRadius: BorderRadius.circular(3))),
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
            height: large ? 18 : 14,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final x = constraints.maxWidth * position.marker;
                return Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(
                      left: 0,
                      right: 0,
                      top: large ? 5 : 4.5,
                      child: Container(
                        height: large ? 8 : 5,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(4),
                          // Bölgeler banda karşılık gelir: %35 solu ucuz, %35–65 adil, %65 sağı pahalı (web ile aynı).
                          gradient: LinearGradient(
                            colors: [c.cheap, c.cheap, c.fair, c.fair, c.pricey, c.pricey],
                            stops: const [0, 0.26, 0.42, 0.58, 0.74, 1],
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: x - (large ? 9 : 7),
                      top: 0,
                      child: Container(
                        width: large ? 18 : 14,
                        height: large ? 18 : 14,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white,
                          border: Border.all(color: color, width: large ? 4 : 3),
                          boxShadow: [BoxShadow(color: cardColor, spreadRadius: 1.5), BoxShadow(color: color.withValues(alpha: 0.5), blurRadius: 8)],
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
