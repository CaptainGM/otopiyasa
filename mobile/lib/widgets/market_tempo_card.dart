import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/theme/app_theme.dart';

/// Piyasa temposu — web'deki MarketTempoCard ile aynı: benzer ilanlar kaç günde yayından kalkıyor, ilanların ne
/// kadarında indirim yapılıyor (pazarlık payı). Veri yetersizse hiç çizilmez; uydurma rakam gösterilmez.
class MarketTempoCard extends StatefulWidget {
  const MarketTempoCard({super.key, required this.carId});

  final String carId;

  @override
  State<MarketTempoCard> createState() => _MarketTempoCardState();
}

class _MarketTempoCardState extends State<MarketTempoCard> {
  late final Future<Map<String, dynamic>?> _future = ApiService().fetchTempo(widget.carId);

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>?>(
      future: _future,
      builder: (context, snapshot) {
        final tempo = snapshot.data;
        final days = tempo?['days'] as Map<String, dynamic>?;
        final drop = tempo?['drop'] as Map<String, dynamic>?;
        if (tempo == null || (days == null && drop == null)) return const SizedBox.shrink();
        final c = AppColors.of(context);
        final pct = NumberFormat.decimalPattern('tr_TR');

        Widget stat(String label, String value, String note) => Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(color: c.muted, fontSize: 12.5)),
                  const SizedBox(height: 2),
                  Text(value, style: AppText.num(size: 22, weight: FontWeight.w600, color: AppTheme.accent2)),
                  Text(note, style: TextStyle(color: c.muted, fontSize: 12)),
                ],
              ),
            );

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
                  Icon(Icons.timeline, size: 15, color: c.muted),
                  const SizedBox(width: 6),
                  Text('PİYASA TEMPOSU', style: AppText.eyebrow(context)),
                  const Spacer(),
                  Flexible(
                    child: Text(
                      tempo['scopeLabel']?.toString() ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: c.muted, fontSize: 12),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (days != null)
                    stat(
                      'Yayında kalma süresi',
                      '~${days['median']} gün',
                      'çoğu ${days['p25']}–${days['p75']} gün · ${days['sample']} ilan',
                    ),
                  if (days != null && drop != null) const SizedBox(width: 12),
                  if (drop != null)
                    stat(
                      'Pazarlık payı',
                      '%${pct.format(drop['medianPct'] ?? 0)}',
                      "ilanların %${drop['share']}'inde indirim · ${drop['sample']} ilan",
                    ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                'Benzer ilanların kaynaktan kalkma süresi ve yayındayken yaptıkları indirimlerden hesaplanır. '
                'Yayından kalkma her zaman satış anlamına gelmez.',
                style: TextStyle(color: c.muted, fontSize: 12.5, height: 1.45),
              ),
            ],
          ),
        );
      },
    );
  }
}
