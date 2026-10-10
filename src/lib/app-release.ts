/** GitHub yayınından mobil uygulama sürüm bilgisi (bkz. src/app/api/app-version/route.ts, release-apk.bat). */
export interface AppVersion {
  version: string;
  versionCode: number;
  /**
   * Bu kodun altındaki uygulamalar güncellemeye zorlanır. Kararı istemci verir
   * (bkz. mobile/lib/services/update_service.dart): yanıt CDN'de herkese ortak saklandığı
   * için "zorunlu mu" sonucu istemciye göre değişemez, bu yüzden eşik gönderilir.
   */
  minVersionCode: number;
  apkUrl: string;
  title: string;
  changelog: string;
  releaseDate: string;
  forceUpdate: boolean;
}

/**
 * Zorunlu güncelleme eşiği. APP_MIN_VERSION_CODE yükseltilince (ör. bozuk bir sürüm geri
 * çekilirken) altındaki tüm uygulamalar güncelleme ekranında kilitlenir. Varsayılan 1'dir,
 * yani normalde kimse zorlanmaz.
 */
export function minVersionCode(): number {
  const value = Number(process.env.APP_MIN_VERSION_CODE || "1");
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function parseRelease(release: {
  tag_name?: string;
  body?: string | null;
  published_at?: string;
  assets?: Array<{ name: string; browser_download_url: string }>;
}): AppVersion | null {
  const body = release.body ?? "";
  const code = Number(/versionCode\s*[:=]\s*(\d+)/i.exec(body)?.[1]);
  const apk = release.assets?.find((a) => a.name.toLowerCase().endsWith(".apk"));
  if (!Number.isFinite(code) || code <= 0 || !apk) return null;
  const changelog = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
  return {
    version: (release.tag_name ?? "").replace(/^v/i, "") || String(code),
    versionCode: code,
    minVersionCode: minVersionCode(),
    apkUrl: apk.browser_download_url,
    title: "OtoPiyasa güncellemesi hazır",
    changelog,
    releaseDate: (release.published_at ?? "").slice(0, 10),
    // Zorunluluk istemciye göre değiştiği için burada sabit false döner; istemci
    // minVersionCode ile kendi kodunu karşılaştırır.
    forceUpdate: false,
  };
}
