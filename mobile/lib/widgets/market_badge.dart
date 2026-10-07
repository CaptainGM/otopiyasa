import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/utils/market_position.dart';
import 'package:otopiyasa/widgets/market_gauge.dart';

/// İlan fiyatı ile aynı marka/model/yıl grubunun aktif ilan ortalaması. Gösterge fiyat bloğunda (MarketGauge);
/// bu kart rakamları ve açıklamayı verir. Bantlar web ile aynı (bkz. utils/market_position.dart): ±%6 adil,
/// %30+ altı "şüpheli ucuz" uyarısı (hatalı fiyat ya da kapora dolandırıcılığı olabilir).
class MarketBadge extends StatelessWidget {
  const MarketBadge({super.key, required this.car});

  final CarListing car;

  static final _money = NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0);

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final avg = car.marketAvgPrice;
    final count = car.marketListingCount;
    final position = MarketPosition.of(car.price, avg, count);

    final decoration = BoxDecoration(
      color: c.surface2,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: c.border),
    );

    if (position == null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: decoration,
        child: Row(
          children: [
            Icon(Icons.info_outline, size: 16, color: c.faint),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Yeterli fiyat verisi yok (${count ?? 0}/3 benzer ilan)',
                style: TextStyle(color: c.muted, fontSize: 12),
              ),
            ),
          ],
        ),
      );
    }

    final diff = car.price - avg!;
    final pct = position.pct;
    final color = MarketGauge.bandColor(context, position.band);
    final String description;
    switch (position.band) {
      case MarketBand.suspicious:
        description =
            "Bu fiyat benzer araçların çok altında. Bu kadar düşük fiyatlar çoğu zaman hatalı girilmiş ya da kapora/dolandırıcılık amaçlı ilanlardır: aracı görmeden ve ekspertiz yaptırmadan ödeme yapma, IBAN'a kapora gönderme.";
      case MarketBand.cheap:
        description = 'Bu ilan, aynı marka/model/yıl grubundaki aktif ilan ortalamasının %${pct.abs()} altında.';
      case MarketBand.pricey:
        description = 'Bu ilan, aynı marka/model/yıl grubundaki aktif ilan ortalamasının %$pct üzerinde.';
      case MarketBand.fair:
        description = 'Bu ilan, aynı marka/model/yıl grubundaki aktif ilan ortalamasına yakın.';
    }
    // marketFamilyLabel yalnızca "aile" kapsamında dolu gelir (bkz. CarListing.fromJson).
    final scope = (car.marketFamilyLabel ?? '').isNotEmpty
        ? '${car.marketFamilyLabel} ailesi, aynı yıl · $count ilan'
        : 'Aynı marka/model/yıl · $count ilan';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: decoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.thermostat_outlined, size: 15, color: c.muted),
              const SizedBox(width: 6),
              Text('FİYAT ANALİZİ', style: AppText.eyebrow(context)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Segment ortalaması', style: TextStyle(fontSize: 11.5, color: c.muted)),
                    const SizedBox(height: 2),
                    Text(
                      _money.format(avg),
                      style: AppText.num(size: 16, weight: FontWeight.w600, color: Theme.of(context).colorScheme.onSurface),
                    ),
                    Text(scope, style: TextStyle(fontSize: 12, color: c.muted)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Fark', style: TextStyle(fontSize: 11.5, color: c.muted)),
                    const SizedBox(height: 2),
                    Text(
                      '${diff > 0 ? '+' : ''}${_money.format(diff)}',
                      style: AppText.num(size: 16, weight: FontWeight.w600, color: color),
                    ),
                    Text(
                      '${pct > 0 ? '+' : pct < 0 ? '−' : ''}%${pct.abs()} · ${position.label.toLowerCase()}',
                      style: TextStyle(fontSize: 12, color: c.muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (position.band == MarketBand.suspicious)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.warning_amber_rounded, size: 17, color: Theme.of(context).colorScheme.error),
                const SizedBox(width: 6),
                Expanded(child: Text(description, style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.error, height: 1.4, fontWeight: FontWeight.w600))),
              ],
            )
          else
            Text(description, style: TextStyle(fontSize: 13, color: c.muted, height: 1.4)),
        ],
      ),
    );
  }
}
