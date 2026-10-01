import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:otopiyasa/services/api_service.dart';
import 'package:otopiyasa/services/data_saver.dart';
import 'package:path_provider/path_provider.dart';

/// İlan fotoğrafları için disk önbelleği. Akış her yenilemede değiştiği için saklama kısa tutulur:
/// 3 gün, 200 dosya. Paket 200 sınırını yalnızca 1 günden eski dosyalara uyguladığından aynı gün
/// içinde görülen her fotoğraf birikebiliyor (ölçüm: 8 yoğun yenilemede 315 dosya, 15 MB; ortalama
/// ~48 KB). Bu yüzden açılışta [trimListingImageCache] sert bir üst sınır uygular.
const _cacheKey = 'listingImages';
const _cacheHardLimitBytes = 30 * 1024 * 1024;

final listingImageCache = CacheManager(
  Config(_cacheKey, stalePeriod: const Duration(days: 3), maxNrOfCacheObjects: 200),
);

/// Önbellek 30 MB'ı aştıysa tamamen boşaltır (uygulama açılışında, arka planda).
Future<void> trimListingImageCache() async {
  try {
    final dir = Directory('${(await getTemporaryDirectory()).path}/$_cacheKey');
    if (!await dir.exists()) return;
    var total = 0;
    await for (final entity in dir.list(recursive: true, followLinks: false)) {
      if (entity is File) total += await entity.length();
    }
    if (total > _cacheHardLimitBytes) await listingImageCache.emptyCache();
  } catch (_) {
    // Önbellek temizliği başarısız olursa uygulama etkilenmez.
  }
}

final _arabamSize = RegExp(r'_\d{2,4}x\d{2,4}\.(jpe?g|png|webp)', caseSensitive: false);

bool _isArabamCdn(String url) => url.contains('mncdn.com/ilanfotograflari/');

String _arabamSized(String url, String size) =>
    url.replaceFirstMapped(_arabamSize, (m) => '_$size.${m.group(1)}');

/// Küçük boyut sunmayan kaynaklar (VavaCars ve eski Carvak kayıtları tek fotoğraf 0,5–1 MB, Otomerkezi
/// ~140 KB, Otoplus 118 KB) sunucuda küçültülür (`/api/img`, bkz. src/lib/image-proxy.ts): 6–12 KB'lık WebP.
const _proxyHosts = {
  'dat-tr-prda-ops-vava.azureedge.net',
  'images.kavak.services',
  'asset.otomerkezi.net',
  'cdn.otoplus.com',
};

bool _isProxyable(String url) {
  final uri = Uri.tryParse(url);
  return uri != null && uri.scheme == 'https' && _proxyHosts.contains(uri.host.toLowerCase());
}

/// Genişlik 80 px adımlarına yuvarlanır (sunucu tarafıyla aynı): aynı fotoğraf tek önbellek kaydı olur.
String _proxied(String url, int width) {
  final w = ((width / 80).ceil() * 80).clamp(160, 1280);
  return '${ApiService().originUrl}/api/img?u=${Uri.encodeComponent(url)}&w=$w';
}

/// Kart küçük resmi için daha hafif varyant (web'deki cardImageUrl ile aynı kurallar).
/// Kaynak sitelerin galeri görselleri 1920 px geliyor; kartta ~480 px yeter. Veri tasarrufu açıkken
/// (hücresel veri) daha da küçük: Arabam 240x180 ≈ 10 KB (normalde 580x435 ≈ 50 KB), Carvak 320 px ≈ 23 KB
/// (normalde 480 px ≈ 45 KB). Otokoç'un daha küçük boyutu yok (450 px ≈ 28 KB).
String cardImageUrl(String url, {bool? lowData}) {
  final low = lowData ?? DataSaver.instance.lowData.value;
  if (_isProxyable(url)) return _proxied(url, low ? 320 : 480);
  if (url.contains('img.carvak.co/') && url.contains('w_1920,h_1080')) {
    return url.replaceFirst('w_1920,h_1080', low ? 'w_320,h_180' : 'w_480,h_270');
  }
  if (url.contains('2el-cdn.otokoc.com.tr/') && url.contains('/car/640x/')) {
    return url.replaceFirst('/car/640x/', '/car/450x/');
  }
  if (_isArabamCdn(url) && _arabamSize.hasMatch(url)) {
    return _arabamSized(url, low ? '240x180' : '580x435');
  }
  return url;
}

/// Galeride bir sonraki sayfa gelene kadar gösterilen çok küçük önizleme (Arabam 240x180 ≈ 10 KB).
/// Boyutu olmayan kaynaklarda kart varyantına döner.
String tinyImageUrl(String url) {
  if (_isArabamCdn(url) && _arabamSize.hasMatch(url)) return _arabamSized(url, '240x180');
  return cardImageUrl(url, lowData: true);
}

/// Tam ekran galeri varyantı: normalde en keskin boyut; veri tasarrufunda Arabam 800x600 (≈90 KB, 1920x1080
/// ≈270 KB yerine) ve Carvak 800 px. Küçük boyut sunmayanlar her iki durumda küçültülür (1280/800 px).
String galleryImageUrl(String url, {bool? lowData}) {
  final low = lowData ?? DataSaver.instance.lowData.value;
  if (_isProxyable(url)) return _proxied(url, low ? 800 : 1280);
  if (low) {
    if (url.contains('img.carvak.co/') && url.contains('w_1920,h_1080')) {
      return url.replaceFirst('w_1920,h_1080', 'w_800,h_450');
    }
    if (_isArabamCdn(url) && _arabamSize.hasMatch(url)) return _arabamSized(url, '800x600');
  }
  return url;
}

/// Denenecek adresler, sırayla: uygun varyant (kartta hafif, galeride tam ekran), orijinal, ve Arabam'da
/// 800x600. CDN eski ilanlarda 1920x1080 üretmiyor; o durumda 800x600 çoğunlukla mevcut.
List<String> imageCandidates(String url, {required bool small, bool? lowData}) {
  final out = <String>[];
  void add(String u) {
    if (u.isNotEmpty && !out.contains(u)) out.add(u);
  }

  add(small ? cardImageUrl(url, lowData: lowData) : galleryImageUrl(url, lowData: lowData));
  add(url);
  if (_isArabamCdn(url) && _arabamSize.hasMatch(url)) add(_arabamSized(url, '800x600'));
  return out;
}

/// CDN başlıkları korumalı araç görseli. Fotoğraflar diske de önbelleklenir: eskiden yalnızca
/// bellekte tutuldukları için uygulama her açılışta bütün kart görsellerini yeniden indiriyordu.
class ListingImage extends StatelessWidget {
  const ListingImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.cacheWidth = 480,
    this.fallbacks = const [],
    this.tinyPreview = false,
  });

  final String url;
  final BoxFit fit;
  final int? cacheWidth;

  /// İlk fotoğraf kaynakta silinmişse (404) denenecek diğer fotoğraflar.
  final List<String> fallbacks;

  /// Galeride tam boy yüklenirken kart varyantı yerine çok küçük (≈10 KB) önizleme göster. Kart
  /// varyantı yalnızca ilk fotoğrafta zaten önbellekte olduğu için bedavadır; diğerlerinde indirilirdi.
  final bool tinyPreview;

  static Map<String, String> _headersFor(String url) {
    final uri = Uri.tryParse(url);
    final host = uri?.host.toLowerCase() ?? '';
    final headers = <String, String>{
      'User-Agent':
          'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };
    if (host.contains('arabam') || host.contains('mncdn')) {
      headers['Referer'] = 'https://www.arabam.com/';
    } else if (host.contains('otomerkezi')) {
      headers['Referer'] = 'https://www.otomerkezi.net/';
    } else if (host.contains('vavacars')) {
      headers['Referer'] = 'https://tr.vava.cars/';
    }
    return headers;
  }

  Widget _placeholder() => Container(
        color: const Color(0xFF202631),
        alignment: Alignment.center,
        child: const Icon(
          Icons.directions_car_outlined,
          size: 38,
          color: Colors.white38,
        ),
      );

  Widget _image(String requestUrl, {int? width, required Widget Function() loading, required Widget Function() failed}) =>
      CachedNetworkImage(
        imageUrl: requestUrl,
        cacheManager: listingImageCache,
        httpHeaders: _headersFor(requestUrl),
        fit: fit,
        memCacheWidth: width,
        fadeInDuration: const Duration(milliseconds: 150),
        fadeOutDuration: Duration.zero,
        placeholder: (_, _) => loading(),
        errorWidget: (_, _, _) => failed(),
      );

  /// Tam boy fotoğraf yüklenirken gösterilecek hafif sürüm (karttan gelindiyse önbellekte).
  Widget _preview(String previewUrl) => _image(previewUrl, width: 480, loading: _placeholder, failed: _placeholder);

  Widget _attempt(List<String> candidates, int index, {String? previewUrl}) => _image(
        candidates[index],
        width: cacheWidth,
        loading: () => previewUrl != null ? _preview(previewUrl) : _placeholder(),
        // Adres yüklenemezse sıradaki adaya geçilir; hepsi biterse yer tutucu kalır.
        failed: () => index + 1 < candidates.length ? _attempt(candidates, index + 1, previewUrl: previewUrl) : _placeholder(),
      );

  @override
  Widget build(BuildContext context) {
    if (url.isEmpty && fallbacks.isEmpty) return _placeholder();
    // Küçük önizlemelerde (kart) hafif varyant; tam ekran galeride orijinal. Galeride orijinal
    // (Arabam'da ~357 KB) yüklenene kadar hafif sürüm gösterilir, boş kutu beklenmez.
    final small = (cacheWidth ?? 9999) <= 700;
    final primary = url.isNotEmpty ? url : fallbacks.first;
    final light = tinyPreview ? tinyImageUrl(primary) : cardImageUrl(primary);
    final candidates = <String>[
      ...imageCandidates(primary, small: small),
      for (final other in fallbacks)
        if (other.isNotEmpty && other != primary) ...imageCandidates(other, small: small).take(1),
    ];
    return _attempt(candidates, 0, previewUrl: !small && light != primary ? light : null);
  }
}
