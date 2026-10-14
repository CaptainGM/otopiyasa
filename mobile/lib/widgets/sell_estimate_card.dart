import 'package:flutter/material.dart';
import 'package:otopiyasa/models/sell_estimate.dart';

/// Satış formundaki piyasa fiyat aralığı. Aralık yalnızca güvenilir olduğunda gösterilir; değilse neden söylenir.
class SellEstimateCard extends StatelessWidget {
  const SellEstimateCard({
    super.key,
    required this.ready,
    required this.loading,
    required this.error,
    required this.estimate,
    required this.damage,
    required this.guard,
  });

  /// Aralık için gerekli alanların hepsi girildi mi.
  final bool ready;
  final bool loading;
  final String? error;
  final SellEstimate? estimate;
  final String? damage;
  final SellPriceGuard guard;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'PİYASA FİYAT ARALIĞI',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white54, letterSpacing: 0.6),
          ),
          const SizedBox(height: 8),
          ..._body(),
        ],
      ),
    );
  }

  List<Widget> _body() {
    if (!ready) {
      return const [
        Text(
          'Marka, model, yıl, kilometre, yakıt, vites ve hasar durumunu seçince benzer ilanlara göre aralık burada görünür.',
          style: TextStyle(color: Colors.white70),
        ),
      ];
    }
    if (loading) {
      return const [Text('Benzer ilanlar kontrol ediliyor…', style: TextStyle(color: Colors.white70))];
    }
    if (error != null) {
      return [Text(error!, style: const TextStyle(color: Color(0xFFFCA5A5)))];
    }
    final data = estimate;
    if (data == null) return const [];

    final tier = data.tier;
    final children = <Widget>[];
    if (data.confident && tier != null) {
      children.addAll([
        Text(
          '${formatLira(tier.p25)} – ${formatLira(tier.p75)}',
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 2),
        Text('Orta değer: ${formatLira(tier.median)}', style: const TextStyle(color: Colors.white70)),
        const SizedBox(height: 4),
        Text(
          '${tier.n} benzer ilana göre · ${tier.label}',
          style: const TextStyle(fontSize: 12, color: Colors.white54),
        ),
        const SizedBox(height: 4),
        const Text(
          'Benzer ilanlar yalnızca hasar durumuna göre ayrılır, boya durumu ayrıca ayrılmaz. Bu bir tahmindir, değer garantisi değildir.',
          style: TextStyle(fontSize: 12, color: Colors.white54),
        ),
      ]);
    } else {
      children.add(Text(data.reason, style: const TextStyle(color: Colors.white70)));
      if (damage == 'hasarli') {
        children.add(const SizedBox(height: 4));
        children.add(const Text(
          'Hasarlı araçlarda benzer ilan sayısı az olduğu için aralık çoğu zaman çıkmaz.',
          style: TextStyle(fontSize: 12, color: Colors.white54),
        ));
      }
    }

    for (final warning in data.warnings) {
      children.add(Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text(warning, style: const TextStyle(fontSize: 12, color: Color(0xFFFCD34D))),
      ));
    }

    if (guard.level == SellGuardLevel.block) {
      children.add(_GuardBox(message: guard.message ?? '', color: const Color(0xFFFCA5A5), background: const Color(0x33EF4444)));
    } else if (guard.level == SellGuardLevel.warn) {
      children.add(_GuardBox(message: guard.message ?? '', color: const Color(0xFFFDE68A), background: const Color(0x26F59E0B)));
    }
    return children;
  }
}

class _GuardBox extends StatelessWidget {
  const _GuardBox({required this.message, required this.color, required this.background});

  final String message;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(10)),
      child: Text(message, style: TextStyle(color: color)),
    );
  }
}
