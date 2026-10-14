// Satış formu fiyat aralığı (sunucu: /api/sell/estimate) ve fiyat kuralı.
//
// Eşikler sunucudan gelir ([SellThresholds]); bu dosyadaki [sellPriceGuard] web'deki `priceGuard`
// (src/lib/sell-estimate.ts) ile aynı mantıktır. Fiyat her değiştiğinde sunucuya gidilmez: aralık yalnızca araç
// özelliklerine bağlıdır, kural burada uygulanır.

/// Türkçe binlik ayraçlı tutar: 1430000 → "1.430.000 TL".
String formatLira(int value) {
  final digits = value.abs().toString();
  final buffer = StringBuffer(value < 0 ? '-' : '');
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write('.');
    buffer.write(digits[i]);
  }
  return '$buffer TL';
}

class SellEstimateTier {
  const SellEstimateTier({
    required this.label,
    required this.n,
    required this.p25,
    required this.median,
    required this.p75,
  });

  final String label;
  final int n;
  final int p25;
  final int median;
  final int p75;

  factory SellEstimateTier.fromJson(Map<String, dynamic> json) => SellEstimateTier(
        label: json['label']?.toString() ?? '',
        n: (json['n'] as num?)?.toInt() ?? 0,
        p25: (json['p25'] as num?)?.round() ?? 0,
        median: (json['median'] as num?)?.round() ?? 0,
        p75: (json['p75'] as num?)?.round() ?? 0,
      );
}

class SellThresholds {
  const SellThresholds({
    required this.highBlock,
    required this.lowBlock,
    required this.warnLow,
    required this.warnHigh,
  });

  final double highBlock;
  final double lowBlock;
  final double warnLow;
  final double warnHigh;

  /// Sunucu eşikleri yoksa web ile aynı varsayılanlar.
  static const fallback = SellThresholds(highBlock: 2.5, lowBlock: 0.4, warnLow: 0.8, warnHigh: 1.2);

  factory SellThresholds.fromJson(Map<String, dynamic>? json) {
    if (json == null) return fallback;
    return SellThresholds(
      highBlock: (json['highBlock'] as num?)?.toDouble() ?? fallback.highBlock,
      lowBlock: (json['lowBlock'] as num?)?.toDouble() ?? fallback.lowBlock,
      warnLow: (json['warnLow'] as num?)?.toDouble() ?? fallback.warnLow,
      warnHigh: (json['warnHigh'] as num?)?.toDouble() ?? fallback.warnHigh,
    );
  }
}

class SellEstimate {
  const SellEstimate({
    required this.confident,
    required this.reason,
    required this.tier,
    required this.damageKnown,
    required this.warnings,
    required this.thresholds,
  });

  final bool confident;
  final String reason;
  final SellEstimateTier? tier;
  final bool damageKnown;
  final List<String> warnings;
  final SellThresholds thresholds;

  factory SellEstimate.fromJson(Map<String, dynamic> json) => SellEstimate(
        confident: json['confident'] == true,
        reason: json['reason']?.toString() ?? '',
        tier: json['tier'] is Map<String, dynamic>
            ? SellEstimateTier.fromJson(json['tier'] as Map<String, dynamic>)
            : null,
        damageKnown: json['damageKnown'] == true,
        warnings: (json['warnings'] as List<dynamic>? ?? const []).map((w) => w.toString()).toList(),
        thresholds: SellThresholds.fromJson(
          json['thresholds'] is Map<String, dynamic> ? json['thresholds'] as Map<String, dynamic> : null,
        ),
      );
}

enum SellGuardLevel { none, warn, block }

class SellPriceGuard {
  const SellPriceGuard(this.level, this.message);

  final SellGuardLevel level;
  final String? message;

  static const none = SellPriceGuard(SellGuardLevel.none, null);
}

/// Girilen fiyat için kural (web'deki priceGuard ile aynı sıra ve metinler).
SellPriceGuard sellPriceGuard(int price, SellEstimate estimate) {
  final tier = estimate.tier;
  if (!estimate.confident || tier == null || price <= 0) return SellPriceGuard.none;
  final t = estimate.thresholds;
  final highText = t.highBlock.toStringAsFixed(1).replaceAll('.', ',');
  final lowPercent = (t.lowBlock * 100).round();

  if (price >= tier.median * t.highBlock) {
    return SellPriceGuard(
      SellGuardLevel.block,
      'Girdiğin fiyat (${formatLira(price)}), benzer araçların orta değeri olan ${formatLira(tier.median)} değerinin $highText katından yüksek. Fiyatı kontrol et.',
    );
  }
  if (estimate.damageKnown && price <= tier.median * t.lowBlock) {
    return SellPriceGuard(
      SellGuardLevel.block,
      'Girdiğin fiyat (${formatLira(price)}), benzer araçların orta değeri olan ${formatLira(tier.median)} değerinin %$lowPercent\'ından düşük. Fiyatı ve hasar durumunu kontrol et.',
    );
  }
  if (price < tier.p25 * t.warnLow || price > tier.p75 * t.warnHigh) {
    return SellPriceGuard(
      SellGuardLevel.warn,
      'Girdiğin fiyat, benzer araçların çoğunun aralığının (${formatLira(tier.p25)} – ${formatLira(tier.p75)}) dışında. Bilinçli bir tercihse devam edebilirsin.',
    );
  }
  return SellPriceGuard.none;
}
