// Hesap/ilan tarafındaki modeller — web'deki API yanıtlarının Dart karşılığı.

/// Kullanıcının kendi ilanı (moderasyon durumu dahil).
class MyListing {
  const MyListing({
    required this.id,
    required this.title,
    required this.brand,
    required this.model,
    required this.year,
    required this.price,
    required this.mileage,
    required this.city,
    required this.imageUrl,
    required this.moderationStatus,
    required this.rejectionReason,
    this.status = 'active',
    this.viewCount = 0,
  });

  final String id;
  final String title;
  final String brand;
  final String model;
  final int year;
  final int price;
  final int mileage;
  final String city;
  final String imageUrl;

  /// approved | pending | rejected
  final String moderationStatus;
  final String rejectionReason;

  /// active | sold | removed
  final String status;
  final int viewCount;

  factory MyListing.fromJson(Map<String, dynamic> json) => MyListing(
        id: (json['_id'] ?? json['id'])?.toString() ?? '',
        title: json['title']?.toString() ?? '',
        brand: json['brand']?.toString() ?? '',
        model: json['model']?.toString() ?? '',
        year: (json['year'] as num?)?.toInt() ?? 0,
        price: (json['price'] as num?)?.toInt() ?? 0,
        mileage: (json['mileage'] as num?)?.toInt() ?? 0,
        city: json['city']?.toString() ?? '',
        imageUrl: json['imageUrl']?.toString() ?? '',
        moderationStatus: json['moderationStatus']?.toString() ?? 'approved',
        rejectionReason: json['rejectionReason']?.toString() ?? '',
        status: json['status']?.toString() ?? 'active',
        viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
      );

  String get statusLabel {
    switch (moderationStatus) {
      case 'pending':
        return 'Moderasyonda';
      case 'rejected':
        return 'Reddedildi';
      default:
        return 'Yayında';
    }
  }

  String get listingStatusLabel => status == 'sold' ? 'Satıldı' : (status == 'removed' ? 'Kaldırıldı' : '');
}

/// Site içi bildirim (teklif, soru, ilan durumu…).
class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.link,
    required this.read,
    required this.createdAt,
  });

  final String id;

  /// comment | business | listing | offer | question
  final String type;
  final String title;
  final String body;

  /// Web yolu (ör. "/offers/123"). Mobilde ilgili ekrana yönlendirmek için
  /// ayrıştırılır; bilinmeyen yollarda yalnızca metin gösterilir.
  final String link;
  final bool read;
  final DateTime? createdAt;

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
        id: (json['_id'] ?? json['id'])?.toString() ?? '',
        type: json['type']?.toString() ?? 'listing',
        title: json['title']?.toString() ?? '',
        body: json['body']?.toString() ?? '',
        link: json['link']?.toString() ?? '',
        read: json['read'] == true,
        createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      );
}

/// Kayıtlı arama / fiyat alarmı.
class SavedSearch {
  const SavedSearch({
    required this.id,
    required this.brand,
    required this.model,
    required this.maxPrice,
    this.targetAvgPrice,
  });

  final String id;
  final String brand;
  final String model;
  final int? maxPrice;

  /// Dolu olduğunda bu bir "yeni ilan" değil, "segment ortalaması bu tutarın
  /// altına düşünce haber ver" alarmıdır (bkz. web lib/segment-alert.ts).
  final int? targetAvgPrice;

  factory SavedSearch.fromJson(Map<String, dynamic> json) => SavedSearch(
        id: (json['_id'] ?? json['id'])?.toString() ?? '',
        brand: json['brand']?.toString() ?? '',
        model: json['model']?.toString() ?? '',
        maxPrice: (json['maxPrice'] as num?)?.toInt(),
        targetAvgPrice: (json['targetAvgPrice'] as num?)?.toInt(),
      );
}
