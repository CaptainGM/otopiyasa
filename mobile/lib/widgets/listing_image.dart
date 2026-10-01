import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
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

/// Kart küçük resmi için daha hafif varyant (web'deki cardImageUrl ile aynı kurallar).
/// Kaynak sitelerin galeri görselleri 1920 px geliyor; kartta ~480 px yeter:
/// Carvak 266 KB → 65 KB, Otoplus 135 KB → 66 KB, Otokoç 52 KB → 34 KB,
/// Arabam 357 KB → 61 KB (580x435; CDN'in sunduğu ara boyutlar 800x600, 580x435, 240x180).
String cardImageUrl(String url) {
  if (url.contains('img.carvak.co/') && url.contains('w_1920,h_1080')) {
    return url.replaceFirst('w_1920,h_1080', 'w_640,h_360');
  }
  if (url.contains('cdn.otoplus.com/') && RegExp(r'_1920x1080.(jpe?g|webp|png)', caseSensitive: false).hasMatch(url)) {
    return url.replaceFirst('_1920x1080.', '_1280x720.');
  }
  if (url.contains('2el-cdn.otokoc.com.tr/') && url.contains('/car/640x/')) {
    return url.replaceFirst('/car/640x/', '/car/450x/');
  }
  if (_isArabamCdn(url) && _arabamSize.hasMatch(url)) {
    return _arabamSized(url, '580x435');
  }
  return url;
}

/// Denenecek adresler, sırayla: hafif varyant (kartta), orijinal, ve Arabam'da 800x600.
/// CDN eski ilanlarda 1920x1080 üretmiyor; o durumda 800x600 çoğunlukla mevcut.
List<String> imageCandidates(String url, {required bool small}) {
  final out = <String>[];
  void add(String u) {
    if (u.isNotEmpty && !out.contains(u)) out.add(u);
  }

  if (small) add(cardImageUrl(url));
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
  });

  final String url;
  final BoxFit fit;
  final int? cacheWidth;

  /// İlk fotoğraf kaynakta silinmişse (404) denenecek diğer fotoğraflar.
  final List<String> fallbacks;

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
    final light = cardImageUrl(primary);
    final candidates = <String>[
      ...imageCandidates(primary, small: small),
      for (final other in fallbacks)
        if (other.isNotEmpty && other != primary) ...imageCandidates(other, small: small).take(1),
    ];
    return _attempt(candidates, 0, previewUrl: !small && light != primary ? light : null);
  }
}
