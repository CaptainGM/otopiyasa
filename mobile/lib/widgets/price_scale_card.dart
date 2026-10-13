import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/price_scale.dart';
import 'package:otopiyasa/theme/app_theme.dart';

/// Fiyat skalası kartı: emsal medyanı, ilanın konumu, fiyat aralığı ve kademe tablosu (web ilan sayfasıyla aynı veri).
/// Yalnızca aile geneli emsal varsa konum yorumu yapılmaz: km, hasar ve donanım farkı büyük olabilir.
class PriceScaleCard extends StatelessWidget {
  const PriceScaleCard({super.key, required this.scale});

  final PriceScale scale;

  static final _money = NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0);

  static String _position(PriceScaleTier tier) {
    final diff = tier.medianDiffPct ?? 0;
    if (diff.abs() < 5) return 'Piyasa seviyesinde';
    return diff < 0 ? 'Medyanın %${diff.abs()} altında' : 'Medyanın %$diff üstünde';
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final tier = scale.chosenTier;
    final median = tier?.median;
    final narrow = tier != null && tier.key != 'aile';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.stacked_bar_chart_outlined, size: 15, color: c.muted),
              const SizedBox(width: 6),
              Text('FİYAT SKALASI', style: AppText.eyebrow(context)),
              const Spacer(),
              if (tier != null) Text('${tier.n} emsal', style: TextStyle(fontSize: 12, color: c.muted)),
            ],
          ),
          const SizedBox(height: 10),
          if (tier != null && median != null) ...[
            Text(
              'Emsal medyanı ${_money.format(median)}${narrow ? ' · ${_position(tier)}' : ''}',
              style: AppText.num(size: 16, weight: FontWeight.w600, color: Theme.of(context).colorScheme.onSurface),
            ),
            const SizedBox(height: 4),
            Text(
              narrow
                  ? 'Emsallerin %${tier.cheaperPct ?? 0} kadarı bu ilandan daha ucuz. Kademe: ${tier.label.toLowerCase()}.'
                  : 'Benzer km, hasar ve donanımda yeterli emsal yok; yalnızca aynı model ailesinin geneli gösteriliyor. Konum yorumu yapılmadı.',
              style: TextStyle(fontSize: 12, color: narrow ? c.muted : Colors.amber.shade300, height: 1.35),
            ),
            const SizedBox(height: 12),
            _ScaleBar(tier: tier, listingPrice: scale.listingPrice, muted: c.muted),
          ] else
            Text(
              'Bu ilan için yeterli emsal yok. Aynı model ailesinden en az 3–5 benzer yayında ilan gerekir.',
              style: TextStyle(fontSize: 12.5, color: c.muted, height: 1.35),
            ),
          const SizedBox(height: 12),
          // Hesaplanamayan donanım kademeleri "0 ilan" diye gösterilmez: 0 "emsal yok" demek olurdu, oysa bilgi eksikti.
          for (final t in scale.tiers.where((t) => !t.missingPackage))
            _TierRow(tier: t, chosen: t.key == scale.chosen, muted: c.muted),
          if (scale.inferredEngine != null) ...[
            const SizedBox(height: 6),
            Text(
              'İlanda motor hacmi yazmıyor; aynı model, yakıt ve vitesteki emsallerin en yaygın motoru '
              '(${scale.inferredEngine!.toStringAsFixed(1).replaceAll('.', ',')} L) esas alındı.',
              style: TextStyle(fontSize: 11, color: Colors.amber.shade300, height: 1.35),
            ),
          ],
          if (scale.tiers.any((t) => t.missingPackage)) ...[
            const SizedBox(height: 6),
            Text(
              'Donanım kademeleri için ilanda motor hacmi, yakıt ve vites bilgisi gerekli; eksik olduğu için gösterilmedi.',
              style: TextStyle(fontSize: 11, color: c.muted, height: 1.35),
            ),
          ],
          const SizedBox(height: 8),
          Text(
            'Donanım eşleşmesi motor hacmi, yakıt, vites ve beygir (±%10) ile yapılır; başlıktaki paket adı yapısal veri olmadığı için kullanılmaz.',
            style: TextStyle(fontSize: 11, color: c.muted, height: 1.35),
          ),
        ],
      ),
    );
  }
}

/// Emsal aralığı çubuğu: p25–p75 bandı, medyan işareti ve ilanın konumu (aralık dışındaysa kenara sabitlenir).
class _ScaleBar extends StatelessWidget {
  const _ScaleBar({required this.tier, required this.listingPrice, required this.muted});

  final PriceScaleTier tier;
  final num listingPrice;
  final Color muted;

  static double _fraction(num value, num min, num max) {
    final span = max - min == 0 ? 1 : max - min;
    return ((value - min) / span).clamp(0, 1).toDouble();
  }

  @override
  Widget build(BuildContext context) {
    final min = tier.min ?? 0;
    final max = tier.max ?? min;
    final accent = Theme.of(context).colorScheme.primary;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth;
            double x(num value) => _fraction(value, min, max) * width;
            final low = x(tier.p25 ?? min);
            final high = x(tier.p75 ?? max);
            return SizedBox(
              height: 22,
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.centerLeft,
                children: [
                  Container(
                    height: 6,
                    width: width,
                    decoration: BoxDecoration(color: muted.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(3)),
                  ),
                  Positioned(
                    left: low,
                    child: Container(
                      height: 6,
                      width: (high - low).clamp(2, width).toDouble(),
                      decoration: BoxDecoration(color: accent.withValues(alpha: 0.45), borderRadius: BorderRadius.circular(3)),
                    ),
                  ),
                  Positioned(
                    left: x(tier.median ?? min) - 1,
                    child: Container(width: 2, height: 14, color: muted),
                  ),
                  Positioned(
                    left: (x(listingPrice) - 7).clamp(0, width - 14).toDouble(),
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: Colors.amber.shade300,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.black54, width: 1),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
        const SizedBox(height: 2),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(NumberFormat.compact(locale: 'tr_TR').format(min), style: TextStyle(fontSize: 11, color: muted)),
            Text(NumberFormat.compact(locale: 'tr_TR').format(max), style: TextStyle(fontSize: 11, color: muted)),
          ],
        ),
      ],
    );
  }
}

class _TierRow extends StatelessWidget {
  const _TierRow({required this.tier, required this.chosen, required this.muted});

  final PriceScaleTier tier;
  final bool chosen;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    final color = chosen ? Theme.of(context).colorScheme.onSurface : muted;
    final value = tier.usable && tier.median != null
        ? '${PriceScaleCard._money.format(tier.median!)} (${tier.n} ilan)'
        : '${tier.n} ilan';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tier.label,
                  style: TextStyle(fontSize: 12.5, color: color, fontWeight: chosen ? FontWeight.w700 : FontWeight.w500),
                ),
                if (tier.note != null) Text(tier.note!, style: TextStyle(fontSize: 11, color: muted)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(value, style: TextStyle(fontSize: 12.5, color: color)),
        ],
      ),
    );
  }
}
