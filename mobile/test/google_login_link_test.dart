import 'package:flutter_test/flutter_test.dart';
import 'package:otopiyasa/utils/google_login_link.dart';

void main() {
  group('parseGoogleLoginLink', () {
    test('bilet içeren dönüş bağlantısını çözer', () {
      final link = parseGoogleLoginLink('https://otopiyasa.app/mobil-giris?code=abc_DEF-123');
      expect(link, isNotNull);
      expect(link!.code, 'abc_DEF-123');
      expect(link.error, isNull);
    });

    test('hata kodlu dönüş bağlantısını çözer', () {
      final link = parseGoogleLoginLink('https://otopiyasa.app/mobil-giris?hata=google_cancel');
      expect(link!.code, isNull);
      expect(link.error, 'google_cancel');
    });

    test('hata kodu boşsa genel hata döner', () {
      final link = parseGoogleLoginLink('https://otopiyasa.app/mobil-giris');
      expect(link!.code, isNull);
      expect(link.error, 'google');
    });

    test('Flutter\'ın rota olarak ilettiği yol biçimi de çözülür', () {
      // Flutter App Link'i şemasız, sunucusuz yol olarak iletir (framework: didPushRouteInformation).
      final link = parseGoogleLoginLink('/mobil-giris?code=abc_DEF-123');
      expect(link!.code, 'abc_DEF-123');
      expect(parseGoogleLoginLink('/mobil-giris?hata=google_state')!.error, 'google_state');
    });

    test('başka alan adı, şema ya da yol reddedilir', () {
      expect(parseGoogleLoginLink('https://evil.example/mobil-giris?code=x'), isNull);
      expect(parseGoogleLoginLink('//evil.example/mobil-giris?code=x'), isNull);
      expect(parseGoogleLoginLink('http://otopiyasa.app/mobil-giris?code=x'), isNull);
      expect(parseGoogleLoginLink('https://otopiyasa.app/cars/64b000000000000000000001'), isNull);
      expect(parseGoogleLoginLink('/cars/64b000000000000000000001'), isNull);
      expect(parseGoogleLoginLink('https://otopiyasa.app/mobil-giris/ek?code=x'), isNull);
      expect(parseGoogleLoginLink('otopiyasa://mobil-giris?code=x'), isNull);
    });

    test('boş ya da geçersiz girdi null döner', () {
      expect(parseGoogleLoginLink(null), isNull);
      expect(parseGoogleLoginLink('   '), isNull);
      expect(parseGoogleLoginLink('/'), isNull);
    });
  });

  group('googleLoginErrorMessage', () {
    test('bilinen hata kodları Türkçe metne çevrilir', () {
      expect(googleLoginErrorMessage('google_cancel'), 'Google ile girişi iptal ettin.');
      expect(googleLoginErrorMessage('google_conflict'), contains('başka bir Google hesabına'));
      expect(googleLoginErrorMessage('google_disabled'), contains('şu an kullanılamıyor'));
    });

    test('bilinmeyen kod genel mesaj verir', () {
      expect(googleLoginErrorMessage('bilinmeyen'), 'Google ile giriş tamamlanamadı. Tekrar dene.');
      expect(googleLoginErrorMessage(null), 'Google ile giriş tamamlanamadı. Tekrar dene.');
    });
  });
}
