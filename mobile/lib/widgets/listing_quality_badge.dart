import 'package:flutter/material.dart';
import 'package:otopiyasa/models/car.dart';

/// İlan kalitesi rozeti: yuvarlak, yalnızca puan. Dokununca altında "İlan kalitesi {puan}" paneli açılır ve puanın nedenini
/// kalem kalem gösterir. Puan ilanın bilgi tamlığını ölçer; aracın durumunu ya da satıcının güvenilirliğini ölçmez.
class ListingQualityBadge extends StatefulWidget {
  const ListingQualityBadge({super.key, required this.quality});

  final ListingCompleteness quality;

  @override
  State<ListingQualityBadge> createState() => _ListingQualityBadgeState();
}

class _ListingQualityBadgeState extends State<ListingQualityBadge> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final score = widget.quality.score;
    final tone = score >= 80
        ? const Color(0xFF7DD3A8)
        : score >= 50
            ? const Color(0xFFF2B544)
            : const Color(0xFFFF8A80);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          button: true,
          label: '$score puan, nedenini görmek için dokun',
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: () => setState(() => _open = !_open),
            child: Container(
              width: 56,
              height: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.black54,
                border: Border.all(color: tone, width: 2),
              ),
              child: Text(
                '$score',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: tone),
              ),
            ),
          ),
        ),
        if (_open) ...[
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 320),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('İlan kalitesi $score', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  const Text(
                    'Puan, aşağıdaki dört kalemin toplamıdır. Her kalemin en fazla puanı yanındadır.',
                    style: TextStyle(fontSize: 11.5, color: Colors.white54),
                  ),
                  const SizedBox(height: 10),
                  for (final item in widget.quality.items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
                                Text(item.note, style: const TextStyle(fontSize: 11.5, color: Colors.white54)),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${item.earned}/${item.max}',
                            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  const Text(
                    'Bu puan ilanın ne kadar eksiksiz bilgi verdiğini ölçer; aracın durumunu ya da satıcının güvenilirliğini ölçmez. '
                    'Ayrıntı: gizlilik politikası, "İlan kalitesi" bölümü.',
                    style: TextStyle(fontSize: 11.5, height: 1.4, color: Colors.white54),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}
