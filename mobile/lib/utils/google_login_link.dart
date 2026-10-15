/// Google ile girişin dönüş bağlantısını çözer (bkz. web: src/app/api/auth/google/callback).
///
/// Başarıda `https://otopiyasa.app/mobil-giris?code=<bilet>`, hatada `https://otopiyasa.app/mobil-giris?hata=<kod>` gelir.
/// Bu bağlantı Android App Link olarak doğrulanmıştır; uygulama açıkken de kapalıyken de bu ekrana düşer.
///
/// Saf fonksiyonlar: navigasyon gerektirmez, testten doğrudan çağrılabilir.
library;

class GoogleLoginLink {
  const GoogleLoginLink({this.code, this.error});

  /// Tek kullanımlık bilet; oturuma çevrilmesi için sunucuya gönderilir.
  final String? code;

  /// Sunucunun hata kodu (ör. google_cancel). Bilet yoksa dolu olur.
  final String? error;
}

const _returnSegment = 'mobil-giris';

/// Bağlantı Google dönüşüne aitse çözümlenmiş halini, değilse null döner.
///
/// Flutter, App Link'i rota olarak iletirken şemayı ve sunucuyu atar (`/mobil-giris?code=...`);
/// bu yüzden hem tam adres hem de yalnızca yol kabul edilir. Şema ya da sunucu varsa ikisi de
/// tam olarak https://otopiyasa.app olmalıdır.
GoogleLoginLink? parseGoogleLoginLink(String? link) {
  if (link == null || link.trim().isEmpty) return null;
  final uri = Uri.tryParse(link.trim());
  if (uri == null) return null;
  final isAbsolute = uri.scheme.isNotEmpty || uri.hasAuthority;
  if (isAbsolute && (uri.scheme != 'https' || uri.host != 'otopiyasa.app')) return null;

  final segments = uri.pathSegments.where((segment) => segment.isNotEmpty).toList();
  if (segments.length != 1 || segments.first != _returnSegment) return null;

  final code = uri.queryParameters['code'];
  if (code != null && code.isNotEmpty) return GoogleLoginLink(code: code);

  final error = uri.queryParameters['hata'];
  return GoogleLoginLink(error: error == null || error.isEmpty ? 'google' : error);
}

/// Sunucunun hata kodunu kullanıcıya gösterilecek Türkçe metne çevirir.
String googleLoginErrorMessage(String? error) {
  switch (error) {
    case 'google_cancel':
      return 'Google ile girişi iptal ettin.';
    case 'google_state':
      return 'Giriş oturumu zaman aşımına uğradı. Tekrar dene.';
    case 'google_conflict':
      return 'Bu e-posta adresi başka bir Google hesabına bağlı.';
    case 'google_disabled':
      return 'Google ile giriş şu an kullanılamıyor.';
    default:
      return 'Google ile giriş tamamlanamadı. Tekrar dene.';
  }
}
