/// Pazarlık kanalı — web'deki `/api/offers` yanıtının Dart karşılığı.
///
/// Alan adları sunucudaki `serializeOffer` çıktısıyla BİREBİR aynı tutuldu ki
/// iki taraf ayrışmasın: durum (`status`) veritabanındaki ham değer değil,
/// 48 saatlik pencere hesaba katılmış GERÇEK durumdur.
class OfferEvent {
  const OfferEvent({
    required this.id,
    required this.kind,
    required this.amount,
    required this.text,
    required this.mine,
    required this.createdAt,
    this.riskFlags = const [],
  });

  final String id;

  /// offer | accepted | rejected | message | expired
  final String kind;
  final int? amount;
  final String text;

  /// Bu olayı görüntüleyen kullanıcı mı yazdı?
  final bool mine;
  final DateTime? createdAt;

  /// off-platform | prepayment — bkz. web lib/chat-safety.ts (aynı sunucu
  /// tarafı hesaplama, mobil yalnızca sonucu gösterir).
  final List<String> riskFlags;

  factory OfferEvent.fromJson(Map<String, dynamic> json) => OfferEvent(
        id: json['id']?.toString() ?? '',
        kind: json['kind']?.toString() ?? 'message',
        amount: (json['amount'] as num?)?.toInt(),
        text: json['text']?.toString() ?? '',
        mine: json['mine'] == true,
        createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
        riskFlags: (json['riskFlags'] as List<dynamic>? ?? []).map((e) => e.toString()).toList(),
      );
}

const Map<String, String> riskFlagLabels = {
  'off-platform': 'Platform dışı iletişime yönlendiriyor olabilir',
  'prepayment': 'Görmeden önce ödeme/kapora istiyor olabilir',
};

class Offer {
  const Offer({
    required this.id,
    required this.carId,
    required this.carTitle,
    required this.carImage,
    required this.carPrice,
    required this.amount,
    required this.status,
    required this.role,
    required this.counterpartName,
    required this.sellerPhone,
    required this.chatOpen,
    required this.canRespond,
    required this.canOfferAgain,
    required this.remainingMs,
    required this.events,
  });

  final String id;
  final String carId;
  final String carTitle;
  final String carImage;
  final int carPrice;
  final int amount;

  /// pending | accepted | rejected | expired
  final String status;

  /// buyer | seller
  final String role;
  final String counterpartName;

  /// Yalnızca teklif kabul edildiğinde ve yalnızca alıcıya dolu gelir.
  final String sellerPhone;
  final bool chatOpen;
  final bool canRespond;
  final bool canOfferAgain;
  final int? remainingMs;
  final List<OfferEvent> events;

  factory Offer.fromJson(Map<String, dynamic> json) => Offer(
        id: json['id']?.toString() ?? '',
        carId: json['carId']?.toString() ?? '',
        carTitle: json['carTitle']?.toString() ?? 'İlan',
        carImage: json['carImage']?.toString() ?? '',
        carPrice: (json['carPrice'] as num?)?.toInt() ?? 0,
        amount: (json['amount'] as num?)?.toInt() ?? 0,
        status: json['status']?.toString() ?? 'pending',
        role: json['role']?.toString() ?? 'buyer',
        counterpartName: json['counterpartName']?.toString() ?? 'Kullanıcı',
        sellerPhone: json['sellerPhone']?.toString() ?? '',
        chatOpen: json['chatOpen'] == true,
        canRespond: json['canRespond'] == true,
        canOfferAgain: json['canOfferAgain'] == true,
        remainingMs: (json['remainingMs'] as num?)?.toInt(),
        events: (json['events'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(OfferEvent.fromJson)
            .toList(),
      );

  String get statusLabel {
    switch (status) {
      case 'accepted':
        return 'Kabul edildi';
      case 'rejected':
        return 'Reddedildi';
      case 'expired':
        return 'Süresi doldu';
      default:
        return 'Yanıt bekliyor';
    }
  }
}

/// İlan soru-cevabı.
class ListingQuestion {
  const ListingQuestion({
    required this.id,
    required this.text,
    required this.answer,
    required this.answered,
    required this.askerName,
  });

  final String id;
  final String text;
  final String answer;
  final bool answered;
  final String askerName;

  factory ListingQuestion.fromJson(Map<String, dynamic> json) => ListingQuestion(
        id: json['id']?.toString() ?? '',
        text: json['text']?.toString() ?? '',
        answer: json['answer']?.toString() ?? '',
        answered: json['answered'] == true,
        askerName: json['askerName']?.toString() ?? 'Kullanıcı',
      );
}
