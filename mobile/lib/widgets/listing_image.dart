import 'package:flutter/material.dart';

/// Kart küçük resmi için daha hafif varyant (web'deki cardImageUrl ile aynı kurallar).
/// Kaynak sitelerin galeri görselleri 1920 px geliyor; kartta ~480 px yeter:
/// Carvak 266 KB → 65 KB, Otoplus 135 KB → 66 KB, Otokoç 52 KB → 34 KB.
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
  return url;
}

/// Hızlı, CDN başlıkları korumalı ve bellek önbelleğinden anında beslenen araç görsel bileşeni.
class ListingImage extends StatelessWidget {
  const ListingImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.cacheWidth = 480,
  });

  final String url;
  final BoxFit fit;
  final int? cacheWidth;

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

  @override
  Widget build(BuildContext context) {
    if (url.isEmpty) return _placeholder();

    // Küçük önizlemelerde (kart) hafif varyant; yüklenemezse aşağıda orijinale düşülür.
    final small = (cacheWidth ?? 9999) <= 700;
    final requestUrl = small ? cardImageUrl(url) : url;

    return Image.network(
      requestUrl,
      fit: fit,
      cacheWidth: cacheWidth,
      headers: _headersFor(requestUrl),
      frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
        if (wasSynchronouslyLoaded || frame != null) {
          return child;
        }
        return _placeholder();
      },
      errorBuilder: (_, _, _) {
        // Hafif varyant yüklenemediyse orijinal adresi dene.
        if (requestUrl != url) {
          return Image.network(
            url,
            fit: fit,
            cacheWidth: cacheWidth,
            headers: _headersFor(url),
            errorBuilder: (_, _, _) => _placeholder(),
          );
        }
        // Eğer Arabam görseli _800x600 ile hata verdiyse _1920x1080 boyutunu dene
        if (url.contains('_800x600.')) {
          final fallbackUrl = url.replaceFirst('_800x600.', '_1920x1080.');
          return Image.network(
            fallbackUrl,
            fit: fit,
            cacheWidth: cacheWidth,
            headers: _headersFor(fallbackUrl),
            errorBuilder: (_, _, _) => _placeholder(),
          );
        }
        return _placeholder();
      },
    );
  }
}
