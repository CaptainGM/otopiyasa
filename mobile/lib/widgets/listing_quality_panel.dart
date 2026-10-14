import 'package:flutter/material.dart';
import 'package:otopiyasa/models/car.dart';

/// İlan kalitesi: puan görünür, dokununca kalemler açılır (üzerine gelmek gerekmez).
/// Puan ilanın bilgi tamlığını ölçer; aracın durumunu ya da satıcının güvenilirliğini ölçmez.
class ListingQualityPanel extends StatefulWidget {
  const ListingQualityPanel({super.key, required this.quality});

  final ListingCompleteness quality;

  @override
  State<ListingQualityPanel> createState() => _ListingQualityPanelState();
}

class _ListingQualityPanelState extends State<ListingQualityPanel> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final score = widget.quality.score;
    final tone = score >= 80
        ? const Color(0xFF7DD3A8)
        : score >= 50
            ? const Color(0xFFF2B544)
            : const Color(0xFFFF8A80);

    return Align(
      alignment: Alignment.centerRight,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisSize: MainAxisSize.min,
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(999),
              onTap: () => setState(() => _open = !_open),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: Colors.white24),
                ),
                child: Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 4,
                  children: [
                    const Text('İlan kalitesi', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
                    Text('$score/100', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: tone)),
                    Icon(_open ? Icons.expand_less : Icons.expand_more, size: 18),
                  ],
                ),
              ),
            ),
            if (_open) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.04),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
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
            ],
          ],
        ),
      ),
    );
  }
}
