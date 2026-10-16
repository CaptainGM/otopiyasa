/**
 * iOS Universal Links dosyası (apple-app-site-association). Google ile girişin dönüşü (/mobil-giris) iOS'ta
 * uygulamayı bu dosya sayesinde açar; Android'deki App Link'in karşılığıdır (bkz. .well-known/assetlinks.json).
 *
 * Uygulama kimliği ("TAKIMKIMLIGI.com.otopiyasa.otopiyasa") Apple Developer hesabı açılınca belli olur; o zamana
 * kadar dosya yayınlanmaz (null). Kimlik yazılınca yalnızca APPLE_APP_ID ortam değişkeni eklenir.
 */
export function appleAppSiteAssociation(appId: string | undefined) {
  const id = appId?.trim();
  if (!id) return null;
  return {
    applinks: {
      apps: [],
      details: [{ appID: id, paths: ["/mobil-giris*"] }],
    },
  };
}
