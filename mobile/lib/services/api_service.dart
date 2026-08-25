import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:otopiyasa/models/car.dart';
import 'package:otopiyasa/models/account.dart';
import 'package:otopiyasa/models/offer.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  /// Sunucu adresi.
  ///
  /// VARSAYILAN CANLI SİTE: uygulama hiçbir ayar yapılmadan açıldığında gerçek
  /// verilerle çalışsın diye. Önceden `http://localhost:3000` idi; bu, telefona
  /// kurulan ya da emülatörde açılan uygulamanın boş ekran göstermesine yol
  /// açıyordu çünkü telefonda öyle bir sunucu yok.
  ///
  /// Yerelde geliştirirken şu şekilde geçersiz kılınır:
  ///   flutter run --dart-define=API_BASE_URL=http://localhost:3000
  ApiService._internal({String? baseUrl})
      : baseUrl = baseUrl ??
            const String.fromEnvironment(
              'API_BASE_URL',
              defaultValue: 'https://otopiyasa.app',
            );

  /// Tüm ekranlar aynı oturumu paylaşsın diye tek örnek kullanılır.
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;

  final String baseUrl;
  static const _tokenKey = 'auth_token';

  String? _authToken;
  Map<String, dynamic>? currentUser;

  bool get isLoggedIn => _authToken != null && currentUser != null;

  String get _androidLocalhost => 'http://10.0.2.2:3000';

  Uri _uri(String path, [Map<String, String>? query]) {
    final host = Platform.isAndroid && baseUrl.contains('localhost')
        ? _androidLocalhost
        : baseUrl;
    return Uri.parse('$host$path').replace(queryParameters: query);
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_authToken != null) 'Cookie': '$_tokenKey=$_authToken',
      };

  /// Uygulama açılışında kayıtlı token'ı geri yükler ve geçerliliğini doğrular.
  Future<void> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    _authToken = prefs.getString(_tokenKey);
    if (_authToken == null) return;

    try {
      final user = await me();
      if (user == null) {
        await _clearSession();
      } else {
        currentUser = user;
      }
    } catch (_) {
      // Sunucuya ulaşılamıyorsa token'ı silme; sonraki istekte tekrar denenir.
    }
  }

  Future<void> _saveToken(String token) async {
    _authToken = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  Future<void> _clearSession() async {
    _authToken = null;
    currentUser = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  Future<CarsResponse> fetchCars({
    String? q,
    String? brand,
    String? model,
    String? fuelType,
    String? transmission,
    String? sort,
    int page = 1,
    int limit = 10,
  }) async {
    final response = await http.get(
      _uri('/api/cars', {
        if (q != null && q.isNotEmpty) 'q': q,
        if (brand != null && brand.isNotEmpty) 'brand': brand,
        if (model != null && model.isNotEmpty) 'model': model,
        if (fuelType != null && fuelType.isNotEmpty) 'fuelType': fuelType,
        if (transmission != null && transmission.isNotEmpty)
          'transmission': transmission,
        if (sort != null && sort.isNotEmpty) 'sort': sort,
        'page': '$page',
        'limit': '$limit',
      }),
      headers: _headers,
    );

    if (response.statusCode != 200) {
      throw Exception('Araçlar yüklenemedi (${response.statusCode})');
    }

    return CarsResponse.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  /// Marka seçilince o markanın gerçek modelleriyle dolan filtre listesi —
  /// web'deki CarFilters ile aynı kaynağı (`getBrandModelOptions`) kullanır.
  Future<Map<String, dynamic>> fetchBrandModels() async {
    final response =
        await http.get(_uri('/api/filters/brand-models'), headers: _headers);
    if (response.statusCode != 200) {
      throw Exception('Marka/model listesi yüklenemedi');
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<CarListing> fetchCar(String id) async {
    final response = await http.get(_uri('/api/cars/$id'), headers: _headers);
    if (response.statusCode != 200) {
      throw Exception('Araç detayı yüklenemedi');
    }
    return CarListing.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  Future<void> importDemoListings() async {
    final response = await http.post(
      _uri('/api/scrape/run'),
      headers: _headers,
      body: jsonEncode({'source': 'demo', 'query': 'otomobil'}),
    );
    if (response.statusCode != 200) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(body['error'] as String? ?? 'Demo veri yüklenemedi');
    }
  }

  Future<void> auth({
    required bool register,
    required String email,
    required String password,
    String? name,
  }) async {
    final response = await http.post(
      _uri('/api/auth/${register ? 'register' : 'login'}'),
      headers: _headers,
      body: jsonEncode({
        'email': email,
        'password': password,
        if (register && name != null) 'name': name,
      }),
    );

    if (response.statusCode != 200) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(body['error'] as String? ?? 'Kimlik doğrulama başarısız');
    }

    // httpOnly cookie mobilde otomatik saklanmaz; Set-Cookie'den token'ı çek.
    final setCookie = response.headers['set-cookie'] ?? '';
    final match = RegExp('$_tokenKey=([^;]+)').firstMatch(setCookie);
    if (match != null) {
      await _saveToken(match.group(1)!);
    }

    final body = jsonDecode(response.body) as Map<String, dynamic>;
    currentUser = body['user'] as Map<String, dynamic>?;
    currentUser ??= await me();
  }

  Future<Map<String, dynamic>?> me() async {
    final response = await http.get(_uri('/api/auth/me'), headers: _headers);
    if (response.statusCode != 200) return null;
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return body['user'] as Map<String, dynamic>?;
  }

  Future<void> logout() async {
    try {
      await http.post(_uri('/api/auth/logout'), headers: _headers);
    } catch (_) {
      // Sunucuya ulaşılamasa bile yerel oturumu temizle.
    }
    await _clearSession();
  }

  Future<List<CarListing>> fetchFavorites() async {
    final response = await http.get(_uri('/api/favorites'), headers: _headers);
    if (response.statusCode == 401) {
      throw Exception('Favoriler için giriş yapmalısınız');
    }
    if (response.statusCode != 200) {
      throw Exception('Favoriler yüklenemedi');
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['favorites'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(CarListing.fromJson)
        .toList();
  }

  Future<void> addFavorite(String carId) async {
    final response = await http.post(
      _uri('/api/favorites'),
      headers: _headers,
      body: jsonEncode({'carId': carId}),
    );
    if (response.statusCode != 200) {
      throw Exception('Favoriye eklenemedi');
    }
  }

  Future<void> removeFavorite(String carId) async {
    final response = await http.delete(
      _uri('/api/favorites'),
      headers: _headers,
      body: jsonEncode({'carId': carId}),
    );
    if (response.statusCode != 200) {
      throw Exception('Favoriden çıkarılamadı');
    }
  }

  // ---------------------------------------------------------------------------
  // TEKLİF / PAZARLIK
  //
  // Web ile AYNI uç noktalar kullanılıyor; veri tek yerde (Atlas) durduğu için
  // uygulamadan verilen teklif tarayıcıda, tarayıcıdan verilen uygulamada
  // anında görünür. Ayrı bir senkronizasyon katmanı yok.
  // ---------------------------------------------------------------------------

  /// Sunucu hatasındaki açıklamayı kullanıcıya aynen gösterebilmek için ayıklar.
  /// (ör. "Satıcı bu ilan için en az 600.000 ₺ teklif kabul ediyor.")
  String _errorOf(http.Response response, String fallback) {
    try {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final message = body['error']?.toString();
      if (message != null && message.isNotEmpty) return message;
    } catch (_) {
      // gövde JSON değilse varsayılana düş
    }
    return fallback;
  }

  /// Alıcı olarak verdiğim teklifler (web'deki "Tekliflerim" ile aynı).
  Future<List<Offer>> fetchMyOffers({String role = 'buying'}) async {
    final response = await http.get(
      _uri('/api/offers', {'role': role}),
      headers: _headers,
    );
    if (response.statusCode == 401) {
      throw Exception('Teklifler için giriş yapmalısınız');
    }
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Teklifler yüklenemedi'));
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['items'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(Offer.fromJson)
        .toList();
  }

  Future<Offer> fetchOffer(String offerId) async {
    final response = await http.get(_uri('/api/offers/$offerId'), headers: _headers);
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Teklif yüklenemedi'));
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return Offer.fromJson(body['offer'] as Map<String, dynamic>);
  }

  /// Teklif ver. Dönen id ile kanal ekranına gidilir.
  Future<String> createOffer({required String carId, required int amount}) async {
    final response = await http.post(
      _uri('/api/offers'),
      headers: _headers,
      body: jsonEncode({'carId': carId, 'amount': amount}),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Teklif gönderilemedi'));
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return body['id']?.toString() ?? '';
  }

  /// Satıcı kabul/ret verir (`accept` / `reject`) ya da mesaj yollar (`message`).
  Future<void> offerAction(
    String offerId, {
    required String action,
    String? text,
  }) async {
    final response = await http.post(
      _uri('/api/offers/$offerId'),
      headers: _headers,
      body: jsonEncode({'action': action, 'text': ?text}),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'İşlem tamamlanamadı'));
    }
  }

  // ---------------------------------------------------------------------------
  // SORU - CEVAP
  // ---------------------------------------------------------------------------

  Future<List<ListingQuestion>> fetchQuestions(String carId) async {
    final response = await http.get(
      _uri('/api/questions', {'carId': carId}),
      headers: _headers,
    );
    if (response.statusCode != 200) {
      throw Exception('Sorular yüklenemedi');
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['items'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(ListingQuestion.fromJson)
        .toList();
  }

  Future<void> askQuestion({required String carId, required String text}) async {
    final response = await http.post(
      _uri('/api/questions'),
      headers: _headers,
      body: jsonEncode({'carId': carId, 'text': text}),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Soru gönderilemedi'));
    }
  }

  /// Yalnızca ilan sahibi yanıtlayabilir (sunucu da doğruluyor).
  Future<void> answerQuestion({required String questionId, required String answer}) async {
    final response = await http.post(
      _uri('/api/questions/$questionId'),
      headers: _headers,
      body: jsonEncode({'answer': answer}),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Cevap kaydedilemedi'));
    }
  }

  // ---------------------------------------------------------------------------
  // İLAN VERME / İLANLARIM
  // ---------------------------------------------------------------------------

  /// Kendi ilanlarım (moderasyon durumu dahil).
  Future<List<MyListing>> fetchMyListings() async {
    final response = await http.get(_uri('/api/listings'), headers: _headers);
    if (response.statusCode == 401) {
      throw Exception('İlanların için giriş yapmalısın');
    }
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'İlanlar yüklenemedi'));
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['items'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(MyListing.fromJson)
        .toList();
  }

  /// İlan oluştur ya da (listingId verilirse) güncelle.
  ///
  /// `images` web ile AYNI biçimde gönderilir: `data:image/jpeg;base64,...`
  /// Sunucu hem http(s) adreslerini hem data URI'leri kabul ediyor.
  /// Dönen `status`: approved | pending | rejected (yapay zeka denetimi).
  Future<Map<String, dynamic>> saveListing({
    String? listingId,
    required String brand,
    required String model,
    required int year,
    required int price,
    required int mileage,
    required String city,
    String district = '',
    required String contactPhone,
    String description = '',
    String fuelType = 'Bilinmiyor',
    String transmission = 'Bilinmiyor',
    String bodyType = 'Belirtilmemiş',
    String color = 'Belirtilmemiş',
    int minOffer = 0,
    List<String> images = const [],
  }) async {
    final payload = {
      'brand': brand,
      'model': model,
      'year': year,
      'price': price,
      'mileage': mileage,
      'city': city,
      'district': district,
      'contactPhone': contactPhone,
      'description': description,
      'fuelType': fuelType,
      'transmission': transmission,
      'bodyType': bodyType,
      'color': color,
      'minOffer': minOffer,
      'images': images,
    };

    final uri = _uri(listingId == null ? '/api/listings' : '/api/listings/$listingId');
    final response = listingId == null
        ? await http.post(uri, headers: _headers, body: jsonEncode(payload))
        : await http.patch(uri, headers: _headers, body: jsonEncode(payload));

    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'İlan kaydedilemedi'));
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<void> deleteListing(String listingId) async {
    final response = await http.delete(_uri('/api/listings/$listingId'), headers: _headers);
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'İlan silinemedi'));
    }
  }

  /// Kendi ilanını "satıldı" işaretle / tekrar yayına al (silmeden — bkz.
  /// web ListingStatusToggle). status: 'active' | 'sold'.
  Future<void> setListingStatus(String listingId, String status) async {
    final response = await http.patch(
      _uri('/api/listings/$listingId/status'),
      headers: _headers,
      body: jsonEncode({'status': status}),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Durum güncellenemedi'));
    }
  }

  // ---------------------------------------------------------------------------
  // ŞİKAYET (ilan ya da teklif sohbeti)
  // ---------------------------------------------------------------------------

  /// Bir ilanı bildir. reason: satildi | yanlis-bilgi | dolandiricilik | uygunsuz | diger
  Future<void> reportListing({required String carId, required String reason, String note = ''}) async {
    final response = await http.post(
      _uri('/api/reports'),
      headers: _headers,
      body: jsonEncode({'carId': carId, 'reason': reason, 'note': note}),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Şikayet gönderilemedi'));
    }
  }

  /// Kabul edilmiş bir teklif sohbetini bildir (küfür/hakaret, dolandırıcılık vb.).
  /// reason: kufur-hakaret | dolandiricilik | uygunsuz | diger
  Future<void> reportChat({required String offerId, required String reason, String note = ''}) async {
    final response = await http.post(
      _uri('/api/reports'),
      headers: _headers,
      body: jsonEncode({'offerId': offerId, 'reason': reason, 'note': note}),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Şikayet gönderilemedi'));
    }
  }

  // ---------------------------------------------------------------------------
  // YAKINIMDAKİ İLANLAR
  // ---------------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> fetchNearby(double lat, double lng) async {
    final response = await http.get(
      _uri('/api/nearby', {'lat': '$lat', 'lng': '$lng'}),
      headers: _headers,
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Yakındaki ilanlar alınamadı'));
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['items'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
  }

  // ---------------------------------------------------------------------------
  // BİLDİRİMLER
  // ---------------------------------------------------------------------------

  Future<List<AppNotification>> fetchNotifications() async {
    final response = await http.get(_uri('/api/notifications'), headers: _headers);
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Bildirimler yüklenemedi'));
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['items'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(AppNotification.fromJson)
        .toList();
  }

  /// Tümünü okundu işaretler (web'deki zil ile aynı uç nokta).
  Future<void> markNotificationsRead() async {
    await http.post(_uri('/api/notifications'), headers: _headers, body: jsonEncode({}));
  }

  // ---------------------------------------------------------------------------
  // KAYITLI ARAMALAR (fiyat alarmı)
  // ---------------------------------------------------------------------------

  Future<List<SavedSearch>> fetchSubscriptions() async {
    final response = await http.get(_uri('/api/subscriptions'), headers: _headers);
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Kayıtlı aramalar yüklenemedi'));
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['subscriptions'] as List<dynamic>? ?? body['items'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(SavedSearch.fromJson)
        .toList();
  }

  Future<void> createSubscription({
    required String email,
    required String brand,
    String model = '',
    int? maxPrice,
    int? targetAvgPrice,
  }) async {
    final response = await http.post(
      _uri('/api/subscriptions'),
      headers: _headers,
      body: jsonEncode({
        'email': email,
        'brand': brand,
        'model': model,
        'maxPrice': ?maxPrice,
        'targetAvgPrice': ?targetAvgPrice,
      }),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Kayıtlı arama eklenemedi'));
    }
  }

  Future<void> deleteSubscription(String id) async {
    final response = await http.delete(
      _uri('/api/subscriptions'),
      headers: _headers,
      body: jsonEncode({'id': id}),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Kayıtlı arama silinemedi'));
    }
  }

  // ---------------------------------------------------------------------------
  // FİYAT TAHMİNİ / KARŞILAŞTIRMA / ASİSTAN
  // ---------------------------------------------------------------------------

  Future<Map<String, dynamic>> predictPrice({
    required String brand,
    required String model,
    required int year,
    required int mileage,
    String condition = 'clean',
  }) async {
    final response = await http.post(
      _uri('/api/predict-price'),
      headers: _headers,
      body: jsonEncode({
        'brand': brand,
        'model': model,
        'year': year,
        'mileage': mileage,
        'condition': condition,
      }),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Tahmin yapılamadı'));
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<List<CarListing>> compareCars(List<String> ids) async {
    final response = await http.get(
      _uri('/api/compare', {'ids': ids.join(',')}),
      headers: _headers,
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Karşılaştırma yüklenemedi'));
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['cars'] as List<dynamic>? ?? body['items'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(CarListing.fromJson)
        .toList();
  }

  /// AI (Gemini) karşılaştırma özeti — 2-4 araç arasında kısa bir öneri metni.
  Future<String?> compareSummary(List<String> ids) async {
    final response = await http.post(
      _uri('/api/compare/summary'),
      headers: _headers,
      body: jsonEncode({'ids': ids}),
    );
    if (response.statusCode != 200) return null;
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return body['summary'] as String?;
  }

  /// Fotoğraftan otomatik doldurma — Gemini Vision marka/model/yıl/hasar
  /// durumunu tanır. `images`: [{image: base64, mimeType: 'image/jpeg'}].
  Future<Map<String, dynamic>?> analyzeCarPhoto(List<Map<String, String>> images) async {
    final response = await http.post(
      _uri('/api/predict-price/analyze-photo'),
      headers: _headers,
      body: jsonEncode({'images': images}),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200) {
      throw Exception(body['error']?.toString() ?? 'Fotoğraf analiz edilemedi');
    }
    return body['analysis'] as Map<String, dynamic>?;
  }

  /// Sohbet asistanı — web'deki widget ile aynı uç nokta.
  Future<Map<String, dynamic>> chat(String message, {List<Map<String, String>>? history}) async {
    final response = await http.post(
      _uri('/api/chatbot'),
      headers: _headers,
      body: jsonEncode({'message': message, 'history': history ?? []}),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Asistan yanıt veremedi'));
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  // ---------------------------------------------------------------------------
  // HESAP
  // ---------------------------------------------------------------------------

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final response = await http.post(
      _uri('/api/auth/change-password'),
      headers: _headers,
      body: jsonEncode({
        'currentPassword': currentPassword,
        'newPassword': newPassword,
        'confirmPassword': newPassword,
      }),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Şifre değiştirilemedi'));
    }
  }

  /// Uygulama tamamen kapalıyken bildirim (FCM) için cihaz jetonunu sunucuya
  /// kaydeder. Sunucuda FCM yapılandırılmamışsa (bkz. src/lib/fcm.ts) uç nokta
  /// yine 200 döner, yalnızca token'ı saklar — zararsız.
  Future<void> registerFcmToken(String token) async {
    final response = await http.post(
      _uri('/api/push/register-fcm-token'),
      headers: _headers,
      body: jsonEncode({'token': token}),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Bildirim jetonu kaydedilemedi'));
    }
  }

  // ---------------------------------------------------------------------------
  // İŞLETME HESABI
  // ---------------------------------------------------------------------------

  Future<void> requestBusiness({required String businessName, required String businessPhone}) async {
    final response = await http.post(
      _uri('/api/business/request'),
      headers: _headers,
      body: jsonEncode({'businessName': businessName, 'businessPhone': businessPhone}),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Başvuru gönderilemedi'));
    }
    // Sunucu businessStatus'u güncelledi — oturumdaki kullanıcıyı tazele ki
    // profil ekranı yeniden açılmadan güncel durumu göstersin.
    currentUser = await me() ?? currentUser;
  }

  // ---------------------------------------------------------------------------
  // E-POSTA DEĞİŞTİRME (iki aşamalı: önce mevcut, sonra yeni adrese kod)
  // ---------------------------------------------------------------------------

  Future<Map<String, dynamic>> startEmailChange(String newEmail) async {
    final response = await http.post(
      _uri('/api/auth/email-change/start'),
      headers: _headers,
      body: jsonEncode({'newEmail': newEmail}),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200) {
      throw Exception(body['error']?.toString() ?? 'İşlem başlatılamadı');
    }
    return body;
  }

  Future<Map<String, dynamic>> verifyCurrentEmailCode(String code) async {
    final response = await http.post(
      _uri('/api/auth/email-change/verify-current'),
      headers: _headers,
      body: jsonEncode({'code': code}),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200) {
      throw Exception(body['error']?.toString() ?? 'Kod doğrulanamadı');
    }
    return body;
  }

  Future<Map<String, dynamic>> verifyNewEmailCode(String code) async {
    final response = await http.post(
      _uri('/api/auth/email-change/verify-new'),
      headers: _headers,
      body: jsonEncode({'code': code}),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200) {
      throw Exception(body['error']?.toString() ?? 'Kod doğrulanamadı');
    }
    currentUser = await me() ?? currentUser;
    return body;
  }

  Future<void> cancelEmailChange() async {
    await http.post(_uri('/api/auth/email-change/cancel'), headers: _headers);
  }

  // ---------------------------------------------------------------------------
  // CANLI PİYASA ORTALAMASI + HAFTANIN FIRSATLARI
  // ---------------------------------------------------------------------------

  Future<Map<String, dynamic>?> fetchMarketAverage(String brand, String model) async {
    final response = await http.get(
      _uri('/api/market-average', {'brand': brand, 'model': model}),
      headers: _headers,
    );
    if (response.statusCode != 200) return null;
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Verilen sırayı koruyarak birden çok ilanı tek istekte getirir (son
  /// bakılanlar şeridi için).
  Future<List<CarListing>> fetchCarsByIds(List<String> ids) async {
    if (ids.isEmpty) return [];
    final response = await http.get(_uri('/api/cars/by-ids', {'ids': ids.join(',')}), headers: _headers);
    if (response.statusCode != 200) return [];
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['items'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(CarListing.fromJson)
        .toList();
  }

  Future<List<CarListing>> fetchDeals() async {
    final response = await http.get(_uri('/api/deals'), headers: _headers);
    if (response.statusCode != 200) return [];
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['items'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map((e) => CarListing.fromJson(e['car'] as Map<String, dynamic>? ?? e))
        .toList();
  }

  /// Analiz verileri: markaya ve model yılına göre ortalama fiyat.
  Future<Map<String, dynamic>> fetchStats() async {
    final response = await http.get(_uri('/api/stats'), headers: _headers);
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'İstatistikler yüklenemedi'));
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Haritadaki kümeler (il/ilçe bazlı sayılar) + filtre seçenekleri.
  /// Dönen `options` (brands/cities/fuels) filtre açılır listelerini doldurur.
  Future<Map<String, dynamic>> fetchMap({
    String? brand,
    String? city,
    String? fuel,
    int? minPrice,
    int? maxPrice,
  }) async {
    final response = await http.get(
      _uri('/api/map', {
        if (brand != null && brand.isNotEmpty) 'brand': brand,
        if (city != null && city.isNotEmpty) 'city': city,
        if (fuel != null && fuel.isNotEmpty) 'fuel': fuel,
        if (minPrice != null && minPrice > 0) 'minPrice': '$minPrice',
        if (maxPrice != null && maxPrice > 0) 'maxPrice': '$maxPrice',
      }),
      headers: _headers,
    );
    if (response.statusCode != 200) {
      throw Exception(_errorOf(response, 'Harita verisi alınamadı'));
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }
}
