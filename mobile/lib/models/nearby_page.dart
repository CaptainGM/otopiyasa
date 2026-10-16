/// "Yakınımdaki ilanlar" tek sayfası (bkz. src/app/api/nearby: radiusKm modu).
class NearbyPage {
  const NearbyPage({
    required this.items,
    required this.hasMore,
    required this.total,
    this.withoutDistrict = 0,
  });

  final List<Map<String, dynamic>> items;

  /// Yarıçapta bu sayfadan sonra da ilan var mı (sonsuz kaydırma buna bakar).
  final bool hasMore;

  /// Filtreye uyan toplam ilan sayısı (yarıçap ve sınıf filtresi uygulanmış).
  final int total;

  /// Yalnızca il düzeyinde konumu olan (mesafesi hesaplanamayan) ilan sayısı; listede yer almaz.
  final int withoutDistrict;

  factory NearbyPage.fromJson(Map<String, dynamic> json) => NearbyPage(
        items: (json['items'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList(),
        hasMore: json['hasMore'] == true,
        total: (json['total'] as num?)?.toInt() ?? 0,
        withoutDistrict: (json['withoutDistrict'] as num?)?.toInt() ?? 0,
      );
}
