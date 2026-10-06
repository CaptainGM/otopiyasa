import 'package:otopiyasa/utils/relative_time.dart';

/// İlanın harita konumu: kayıtlı koordinat (exact) ya da ilçe/il merkezi (district/province).
class MapPoint {
  const MapPoint({required this.lat, required this.lng, required this.level});

  final double lat;
  final double lng;

  /// exact | district | province
  final String level;

  double get zoom => level == 'province' ? 9 : (level == 'district' ? 12 : 14);

  String get note => level == 'district'
      ? 'Yaklaşık konum: ilçe merkezi'
      : (level == 'province' ? 'Yaklaşık konum: il merkezi' : '');

  static MapPoint? fromJson(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    final lat = (json['lat'] as num?)?.toDouble();
    final lng = (json['lng'] as num?)?.toDouble();
    if (lat == null || lng == null) return null;
    return MapPoint(lat: lat, lng: lng, level: json['level']?.toString() ?? 'district');
  }
}

class PricePoint {
  PricePoint({required this.price, required this.recordedAt});

  final int price;
  final DateTime recordedAt;

  factory PricePoint.fromJson(Map<String, dynamic> json) {
    return PricePoint(
      price: (json['price'] as num?)?.toInt() ?? 0,
      recordedAt:
          DateTime.tryParse(json['recordedAt'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

class PriceBin {
  const PriceBin({required this.label, required this.count, required this.isCurrent});

  final String label;
  final int count;
  final bool isCurrent;

  factory PriceBin.fromJson(Map<String, dynamic> json) => PriceBin(
        label: json['label']?.toString() ?? '',
        count: (json['count'] as num?)?.toInt() ?? 0,
        isCurrent: json['isCurrent'] == true,
      );
}

class PriceAnomaly {
  const PriceAnomaly({required this.z, required this.pctFromMean, required this.label, required this.sampleCount});

  final double z;
  final int pctFromMean;

  /// ucuz | pahali
  final String? label;
  final int sampleCount;

  factory PriceAnomaly.fromJson(Map<String, dynamic> json) => PriceAnomaly(
        z: (json['z'] as num?)?.toDouble() ?? 0,
        pctFromMean: (json['pctFromMean'] as num?)?.toInt() ?? 0,
        label: json['label'] as String?,
        sampleCount: (json['sampleCount'] as num?)?.toInt() ?? 0,
      );
}

class DamagePart {
  const DamagePart({required this.name, required this.state});

  final String name;

  /// Değişmiş | Boyanmış | Lokal Boyanmış | Orijinal
  final String state;

  factory DamagePart.fromJson(Map<String, dynamic> json) => DamagePart(
        name: json['name']?.toString() ?? '',
        state: json['state']?.toString() ?? '',
      );
}

class CarListing {
  CarListing({
    required this.id,
    required this.title,
    required this.brand,
    required this.model,
    required this.year,
    required this.price,
    required this.mileage,
    required this.city,
    required this.description,
    required this.imageUrl,
    this.images = const [],
    required this.sourceSite,
    required this.listingUrl,
    this.marketAvgPrice,
    this.marketListingCount,
    this.marketFamilyLabel,
    this.priceVsMarket,
    this.fuelType = 'Bilinmiyor',
    this.transmission = 'Bilinmiyor',
    this.bodyType = 'Otomobil',
    this.color = '',
    this.engineSize,
    this.horsepower,
    this.drivetrain = '',
    this.avgFuelConsumption = '',
    this.listingDate = '',
    this.createdAt,
    this.priceHistory = const [],
    this.address = '',
    this.status = 'active',
    this.lastVerifiedAt,
    this.removedAt,
    this.removedReason = '',
    this.viewCount = 0,
    this.favoriteCount = 0,
    this.priceBins = const [],
    this.segmentLabel = '',
    this.anomaly,
    this.paintChange = '',
    this.damageFlag = false,
    this.damageParts = const [],
    this.similarCars = const [],
    this.mapPoint,
  });

  final String id;
  final String title;
  final String brand;
  final String model;
  final int year;
  final int price;
  final int mileage;
  final String city;
  final String description;
  final String imageUrl;
  final List<String> images;
  final String sourceSite;
  final String listingUrl;
  final int? marketAvgPrice;
  final int? marketListingCount;

  /// Doluysa piyasa ortalaması aynı yılın tüm donanımlarından hesaplandı ("Corolla").
  final String? marketFamilyLabel;
  final int? priceVsMarket;
  final String fuelType;
  final String transmission;
  final String bodyType;
  final String color;
  final double? engineSize;
  final int? horsepower;
  final String drivetrain;
  final String avgFuelConsumption;

  /// Kaynak sitedeki ilan tarihi (metin, ör. "19 Eylül 2026"); bilinmiyorsa boş.
  final String listingDate;

  /// İlanın sistemimize ilk girdiği an; hiç yeniden doğrulanmamış ilanda son kontrol yerine geçer.
  final DateTime? createdAt;
  final List<PricePoint> priceHistory;
  final String address;

  /// active | sold | removed — eski kayıtlarda alan yok, "active" varsayılır.
  final String status;

  /// Kaynağa gidilip ilanın yayında olduğunun son teyit edildiği an (yoksa null).
  final DateTime? lastVerifiedAt;

  /// Kaynaktan kaldırıldığı için arşive taşındığı an (yalnızca arşivdeki ilanlarda).
  final DateTime? removedAt;
  final String removedReason;
  final int viewCount;
  final int favoriteCount;
  final List<PriceBin> priceBins;
  final String segmentLabel;
  final PriceAnomaly? anomaly;
  final String paintChange;
  final bool damageFlag;
  final List<DamagePart> damageParts;
  final List<CarListing> similarCars;

  /// Haritada gösterilecek konum (yalnızca ilan detay yanıtında gelir).
  final MapPoint? mapPoint;

  bool get isActive => status == 'active';

  /// "Kaynakta son kontrol: 3 saat önce" satırı; üye ilanlarında ve arşivde yok.
  /// Hiç yeniden doğrulanmamış ilanda son kontrol, ilanın kaynakta ilk görüldüğü andır.
  String get verifiedLabel {
    final checked = lastVerifiedAt ?? createdAt;
    if (sourceSite == 'user' || !isActive || checked == null) return '';
    return 'Kaynakta son kontrol: ${relativeTimeTr(checked)}';
  }

  String get statusLabel {
    switch (status) {
      case 'sold':
        return 'Satıldı';
      case 'removed':
        return 'Kaynaktan kaldırıldı';
      default:
        return '';
    }
  }

  factory CarListing.fromJson(Map<String, dynamic> json) {
    final features = json['features'] as Map<String, dynamic>? ?? {};
    return CarListing(
      id: json['_id'] as String,
      title: json['title'] as String? ?? '',
      brand: json['brand'] as String? ?? '',
      model: json['model'] as String? ?? '',
      year: (json['year'] as num?)?.toInt() ?? 0,
      price: (json['price'] as num?)?.toInt() ?? 0,
      mileage: (json['mileage'] as num?)?.toInt() ?? 0,
      city: json['city'] as String? ?? '',
      description: json['description'] as String? ?? '',
      imageUrl: json['imageUrl'] as String? ?? '',
      images: (json['images'] as List<dynamic>? ?? [])
          .map((e) => e.toString())
          .where((e) => e.isNotEmpty)
          .toList(),
      sourceSite: json['sourceSite'] as String? ?? 'demo',
      listingUrl: json['listingUrl'] as String? ?? '',
      marketAvgPrice: (json['marketAvgPrice'] as num?)?.toInt(),
      marketListingCount: (json['marketListingCount'] as num?)?.toInt(),
      marketFamilyLabel: json['marketScope'] == 'family' ? json['marketFamilyLabel'] as String? : null,
      priceVsMarket: (json['priceVsMarket'] as num?)?.toInt(),
      fuelType: features['fuelType'] as String? ?? 'Bilinmiyor',
      transmission: features['transmission'] as String? ?? 'Bilinmiyor',
      bodyType: features['bodyType'] as String? ?? 'Otomobil',
      color: features['color'] as String? ?? '',
      engineSize: (features['engineSize'] as num?)?.toDouble(),
      horsepower: (features['horsepower'] as num?)?.toInt(),
      drivetrain: features['drivetrain'] as String? ?? '',
      avgFuelConsumption: features['avgFuelConsumption']?.toString() ?? '',
      listingDate: json['listingDate'] as String? ?? '',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      priceHistory: (json['priceHistory'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(PricePoint.fromJson)
          .toList(),
      address: json['address'] as String? ?? '',
      status: json['status'] as String? ?? 'active',
      lastVerifiedAt: DateTime.tryParse(json['lastVerifiedAt']?.toString() ?? ''),
      removedAt: DateTime.tryParse(json['removedAt']?.toString() ?? ''),
      removedReason: json['removedReason'] as String? ?? '',
      viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
      favoriteCount: (json['favoriteCount'] as num?)?.toInt() ?? 0,
      priceBins: (json['priceBins'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(PriceBin.fromJson)
          .toList(),
      segmentLabel: json['segmentLabel'] as String? ?? '',
      anomaly: json['anomaly'] is Map<String, dynamic>
          ? PriceAnomaly.fromJson(json['anomaly'] as Map<String, dynamic>)
          : null,
      paintChange: json['paintChange'] as String? ?? '',
      damageFlag: json['damageFlag'] == true,
      damageParts: (json['damageParts'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(DamagePart.fromJson)
          .toList(),
      similarCars: (json['similarCars'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(CarListing.fromJson)
          .toList(),
      mapPoint: MapPoint.fromJson(json['mapPoint']),
    );
  }
}

class CarsResponse {
  CarsResponse({
    required this.items,
    required this.total,
    required this.page,
    required this.totalPages,
  });

  final List<CarListing> items;
  final int total;
  final int page;
  final int totalPages;

  factory CarsResponse.fromJson(Map<String, dynamic> json) {
    final items = (json['items'] as List<dynamic>? ?? [])
        .map((item) => CarListing.fromJson(item as Map<String, dynamic>))
        .toList();
    return CarsResponse(
      items: items,
      total: (json['total'] as num?)?.toInt() ?? 0,
      page: (json['page'] as num?)?.toInt() ?? 1,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
    );
  }
}
