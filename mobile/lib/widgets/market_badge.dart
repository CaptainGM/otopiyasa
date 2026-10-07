import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/theme/app_theme.dart';
import 'package:otopiyasa/utils/market_position.dart';
import 'package:otopiyasa/widgets/market_gauge.dart';

/// Fiyat analizi — web ilan sayfasındaki kartla aynı ölçü: ilan fiyatı, model yılı, km, hasar ve donanıma göre
/// hesaplanan ADİL DEĞERLE karşılaştırılır (üstteki gösterge de bu sayıyı kullanır). Aynı marka/model/yılın ham
/// ilan ortalaması yalnızca bağlam olarak gösterilir (km ve donanım farkını gözetmez). Bantlar: ±%6 adil, %30+ altı
/// "şüpheli ucuz" uyarısı.
class MarketBadge extends StatelessWidget {
  const MarketBadge({super.key, required this.car});

  final CarListing car;

  static final _money = NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0);

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final fair = car.fairPrice;
    final sample = car.fairSample;
    final position = MarketPosition.of(car.price, fair, sample);

    final decoration = BoxDecoration(
      color: c.surface2,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: c.border),
    );

    if (position == null || fair == null) {
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
                'Bu ilan için yeterli emsal yok; adil piyasa değeri hesaplanamadı.',
                style: TextStyle(color: c.muted, fontSize: 12.5),
              ),
            ),
          ],
        ),
      );
    }

    final diff = car.price - fair;
    final pct = position.pct;
    final color = MarketGauge.bandColor(context, position.band);
    final String description;
    switch (position.band) {
      case MarketBand.suspicious:
        description =
            "Bu fiyat benzer araçların çok altında. Bu kadar düşük fiyatlar çoğu zaman hatalı girilmiş ya da kapora/dolandırıcılık amaçlı ilanlardır: aracı görmeden ve ekspertiz yaptırmadan ödeme yapma, IBAN'a kapora gönderme.";
      case MarketBand.cheap:
        description = 'Model yılı, kilometresi ve hasar durumu benzer araçlara göre %${pct.abs()} daha uygun fiyatlı.';
      case MarketBand.pricey:
        description = 'Model yılı, kilometresi ve hasar durumu benzer araçlara göre %$pct daha yüksek fiyatlı.';
      case MarketBand.fair:
        description = 'Fiyat, model yılı, kilometresi ve hasar durumuna göre hesaplanan adil piyasa değeriyle uyumlu.';
    }
    final avg = car.marketAvgPrice;
    final avgCount = car.marketListingCount ?? 0;

    Widget cell(String label, String value, String note, {Color? valueColor}) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: TextStyle(fontSize: 12, color: c.muted)),
              const SizedBox(height: 2),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  value,
                  style: AppText.num(size: 16, weight: FontWeight.w600, color: valueColor ?? Theme.of(context).colorScheme.onSurface),
                ),
              ),
              Text(note, style: TextStyle(fontSize: 11.5, color: c.muted)),
            ],
          ),
        );

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
              const Spacer(),
              Text('$sample emsal', style: TextStyle(fontSize: 12, color: c.muted)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              cell('Adil piyasa değeri', _money.format(fair), 'km ve hasara göre'),
              const SizedBox(width: 12),
              cell(
                'Fark',
                '${diff > 0 ? '+' : ''}${_money.format(diff)}',
                '${pct > 0 ? '+' : pct < 0 ? '−' : ''}%${pct.abs()} · ${position.label.toLowerCase()}',
                valueColor: color,
              ),
            ],
          ),
          if (avg != null && avg > 0 && avgCount >= 3) ...[
            const SizedBox(height: 10),
            Text(
              'Aynı marka/model/yıl ham ilan ortalaması ${_money.format(avg)} ($avgCount ilan; km ve donanım farkını gözetmez).',
              style: TextStyle(fontSize: 12, color: c.muted, height: 1.35),
            ),
          ],
          const SizedBox(height: 10),
          if (position.band == MarketBand.suspicious)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.warning_amber_rounded, size: 17, color: Theme.of(context).colorScheme.error),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    description,
                    style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.error, height: 1.4, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            )
          else
            Text(description, style: TextStyle(fontSize: 13, color: c.muted, height: 1.4)),
        ],
      ),
    );
  }
}
