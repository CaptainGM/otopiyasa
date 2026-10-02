import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// İlanın km başına yakıt maliyeti: resmi ortalama tüketim × ilanın ilindeki güncel pompa fiyatı
/// (web'deki FuelCostCard ile aynı veri, bkz. src/lib/fuel-cost.ts).
class FuelCostCard extends StatelessWidget {
  const FuelCostCard({super.key, required this.cost});

  final Map<String, dynamic> cost;

  static String _tl(num value, [int digits = 2]) =>
      NumberFormat.decimalPatternDigits(locale: 'tr_TR', decimalDigits: digits).format(value);

  @override
  Widget build(BuildContext context) {
    final perKm = (cost['perKm'] as num?) ?? 0;
    final per100 = (cost['per100Km'] as num?) ?? 0;
    final petrol100 = cost['petrolPer100Km'] as num?;
    final consumption = (cost['consumption'] as num?) ?? 0;
    final priceFuel = cost['priceFuel']?.toString() ?? '';
    final pricePerLiter = (cost['pricePerLiter'] as num?) ?? 0;
    final rating = cost['rating']?.toString();
    final ratingText = cost['ratingText']?.toString();
    final note = cost['note']?.toString();
    final fromModel = cost['consumptionSource'] == 'model';
    final date = DateTime.tryParse(cost['priceDate']?.toString() ?? '')?.toLocal();
    final dateText = date == null ? '' : DateFormat('d MMMM HH:mm', 'tr_TR').format(date);
    final plug = cost['plugIn'] as Map<String, dynamic>?;

    final accent = rating == 'low'
        ? const Color(0xFF34D399)
        : rating == 'high'
            ? const Color(0xFFFB923C)
            : Colors.white24;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: rating == null ? 0.04 : 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('⛽ Yakıt maliyeti', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 2),
          Text(
            '${cost['place'] ?? ''} pompa fiyatı · ${cost['priceSource'] ?? ''} · $dateText',
            style: const TextStyle(fontSize: 11, color: Colors.white54),
          ),
          const SizedBox(height: 8),
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.end,
            spacing: 16,
            runSpacing: 4,
            children: [
              Text.rich(TextSpan(children: [
                TextSpan(
                  text: '${_tl(perKm)} ₺',
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Color(0xFFF5B942)),
                ),
                TextSpan(text: plug != null ? ' / km (evde şarjla)' : ' / km', style: const TextStyle(fontSize: 13, color: Colors.white60)),
              ])),
              Text('100 km: ${_tl(per100, 0)} ₺', style: const TextStyle(fontSize: 13)),
              if (petrol100 != null)
                Text('Benzinle 100 km: ${_tl(petrol100, 0)} ₺', style: const TextStyle(fontSize: 12, color: Colors.white60)),
            ],
          ),
          if (plug != null) ..._plugInLines(plug, consumption, priceFuel, pricePerLiter, note)
          else ...[
          const SizedBox(height: 8),
          Text(
            'Resmi ortalama tüketim ${_tl(consumption, 1)} lt/100 km'
            '${fromModel ? ' (${cost['consumptionNote'] ?? 'aynı modelin resmi değeri'})' : ''} × $priceFuel ${_tl(pricePerLiter)} ₺/lt'
            '${priceFuel == 'LPG' ? ' (LPG\'de tüketim ~%20 fazla hesaplandı)' : ''}.',
            style: const TextStyle(fontSize: 11, color: Colors.white54),
          ),
          if (ratingText != null && ratingText.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              '${rating == 'low' ? '✅' : '⚠️'} $ratingText',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: accent),
            ),
          ],
          if (note != null && note.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text('ℹ️ $note', style: const TextStyle(fontSize: 11, color: Colors.white54)),
          ],
          ],
        ],
      ),
    );
  }

  /// Şarjlı hibrit: benzin + elektrik dökümü ve diğer senaryolar (bkz. src/lib/fuel-cost.ts, plugIn).
  List<Widget> _plugInLines(Map<String, dynamic> plug, num consumption, String priceFuel, num pricePerLiter, String? note) {
    final publicKm = plug['perKmPublicCharge'] as num?;
    final emptyKm = plug['perKmEmptyBattery'] as num?;
    final fuel100 = (plug['fuelPer100Km'] as num?) ?? 0;
    final electric100 = (plug['electricPer100Km'] as num?) ?? 0;
    final kwh = (plug['electricKwhPer100'] as num?) ?? 0;
    final home = (plug['homePricePerKwh'] as num?) ?? 0;
    final pub = (plug['publicPricePerKwh'] as num?) ?? 0;
    return [
      const SizedBox(height: 8),
      Text.rich(
        TextSpan(style: const TextStyle(fontSize: 13), children: [
          const TextSpan(text: 'Halka açık şarjla '),
          TextSpan(text: '${_tl(publicKm ?? 0)} ₺/km', style: const TextStyle(fontWeight: FontWeight.w700)),
          if (emptyKm != null) ...[
            const TextSpan(text: ' · Şarj bitince benzinli gibi '),
            TextSpan(text: '${_tl(emptyKm)} ₺/km', style: const TextStyle(fontWeight: FontWeight.w700)),
          ],
        ]),
      ),
      const SizedBox(height: 6),
      Text(
        'Benzin: resmi ${_tl(consumption, 1)} lt/100 km × $priceFuel ${_tl(pricePerLiter)} ₺/lt = ${_tl(fuel100, 0)} ₺. '
        'Elektrik: ${kwh.toStringAsFixed(0)} kWh/100 km × ${_tl(home, 1)} ₺/kWh (ev) = ${_tl(electric100, 0)} ₺. '
        'Halka açık AC şarj ~${_tl(pub, 1)} ₺/kWh alındı.',
        style: const TextStyle(fontSize: 11, color: Colors.white54),
      ),
      if (note != null && note.isNotEmpty) ...[
        const SizedBox(height: 6),
        Text(
          'ℹ️ $note Elektrik fiyatları tahminidir (${plug['electricityReviewed'] ?? ''} itibarıyla), pompa fiyatı gibi günlük güncellenmez.',
          style: const TextStyle(fontSize: 11, color: Colors.white54),
        ),
      ],
    ];
  }
}
