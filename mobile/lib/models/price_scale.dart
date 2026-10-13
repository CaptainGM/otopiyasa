/// Fiyat skalası: ilanın emsallerinin yıl, km, hasar ve donanım kademelerine göre istatistikleri (web ile aynı veri,
/// bkz. GET /api/cars/:id/price-scale).
class PriceScaleTier {
  const PriceScaleTier({
    required this.key,
    required this.label,
    required this.n,
    required this.minN,
    required this.usable,
    this.note,
    this.missingPackage = false,
    this.min,
    this.p25,
    this.median,
    this.p75,
    this.max,
    this.mean,
    this.cheaperPct,
    this.medianDiffPct,
  });

  final String key;
  final String label;
  final int n;
  final int minN;
  final bool usable;

  /// Kademe kullanılamıyorsa nedeni (ör. "en az 5 ilan gerekli").
  final String? note;

  /// Donanım kademesi, ilanda motor/yakıt/vites bilgisi olmadığı için hiç hesaplanamadı (gösterilmez).
  final bool missingPackage;
  final num? min;
  final num? p25;
  final num? median;
  final num? p75;
  final num? max;
  final num? mean;

  /// Emsallerin yüzde kaçı bu ilandan daha ucuz.
  final int? cheaperPct;

  /// İlanın fiyatının medyana göre farkı, yüzde (negatif: medyanın altında).
  final int? medianDiffPct;

  factory PriceScaleTier.fromJson(Map<String, dynamic> json) => PriceScaleTier(
        key: json['key'] as String? ?? '',
        label: json['label'] as String? ?? '',
        n: (json['n'] as num?)?.toInt() ?? 0,
        minN: (json['minN'] as num?)?.toInt() ?? 0,
        usable: json['usable'] == true,
        note: json['note'] as String?,
        missingPackage: json['missingPackage'] == true,
        min: json['min'] as num?,
        p25: json['p25'] as num?,
        median: json['median'] as num?,
        p75: json['p75'] as num?,
        max: json['max'] as num?,
        mean: json['mean'] as num?,
        cheaperPct: (json['cheaperPct'] as num?)?.toInt(),
        medianDiffPct: (json['medianDiffPct'] as num?)?.toInt(),
      );
}

class PriceScale {
  const PriceScale({
    required this.listingPrice,
    required this.packageKnown,
    required this.tiers,
    required this.sample,
    this.chosen,
    this.inferredEngine,
  });

  final num listingPrice;
  final bool packageKnown;

  /// İlanda motor hacmi yazmıyorsa, emsallerin baskın motoru (litre); donanım kademeleri bununla hesaplanır.
  final double? inferredEngine;
  final List<PriceScaleTier> tiers;

  /// Seçili kademe anahtarı ("tam", "donanim", "km", "aile"); yeterli emsal yoksa null.
  final String? chosen;

  /// Seçili kademenin fiyatları (sıralı, en fazla 60 nokta).
  final List<num> sample;

  PriceScaleTier? get chosenTier {
    for (final tier in tiers) {
      if (tier.key == chosen) return tier;
    }
    return null;
  }

  factory PriceScale.fromJson(Map<String, dynamic> json) => PriceScale(
        listingPrice: json['listingPrice'] as num? ?? 0,
        packageKnown: json['packageKnown'] == true,
        inferredEngine: (json['inferredEngine'] as num?)?.toDouble(),
        tiers: [
          for (final tier in (json['tiers'] as List? ?? const []))
            PriceScaleTier.fromJson(Map<String, dynamic>.from(tier as Map)),
        ],
        chosen: json['chosen'] as String?,
        sample: [for (final value in (json['sample'] as List? ?? const [])) value as num],
      );
}
