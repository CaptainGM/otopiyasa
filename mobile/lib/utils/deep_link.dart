/// Bildirimlere ve paylaşılan bağlantılara dokunulduğunda hangi ilanın açılacağını çözer.
///
/// İki biçim desteklenir:
///  - Web bağlantısı: `https://otopiyasa.app/cars/<id>`  → pathSegments = ["cars", "<id>"]
///  - Özel şema:      `otopiyasa://cars/<id>`            → pathSegments = ["<id>"]
///    (özel şemada "cars" host kısmına düşer, bu yüzden tek parça kalır)
///
/// Saf fonksiyon: navigasyon bağlamı gerektirmez, testten doğrudan çağrılabilir.
library;

final RegExp _objectId = RegExp(r'^[0-9a-f]{24}$', caseSensitive: false);

String? carIdFromDeepLink(String? link) {
  if (link == null || link.trim().isEmpty) return null;
  final uri = Uri.tryParse(link.trim());
  if (uri == null) return null;

  final segments = uri.pathSegments.where((segment) => segment.isNotEmpty).toList();
  if (segments.length >= 2 && segments[0] == 'cars') return _validId(segments[1]);
  if (segments.length == 1) return _validId(segments[0]);
  return null;
}

String? _validId(String value) => _objectId.hasMatch(value) ? value : null;
