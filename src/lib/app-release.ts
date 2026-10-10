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

/** Cihazın bildirebileceği mimariler ve yayındaki paket adları. */
export const SUPPORTED_ABIS = ["arm64-v8a", "armeabi-v7a"] as const;
export type SupportedAbi = (typeof SUPPORTED_ABIS)[number];

export function isSupportedAbi(value: unknown): value is SupportedAbi {
  return typeof value === "string" && (SUPPORTED_ABIS as readonly string[]).includes(value);
}

/**
 * İndirilecek paketi seçer.
 *
 * Yayın üç paket içeriyor: mimariye göre bölünmüş `app-arm64-v8a-release.apk` (~23 MB) ve
 * `app-armeabi-v7a-release.apk` (~21 MB) ile tüm mimarileri kapsayan `otopiyasa-release.apk`
 * (~65 MB). İstemci kendi mimarisini bildirirse (bkz. mobile/lib/services/device_abi.dart)
 * küçük paket verilir; bildirmezse ya da eşleşme yoksa evrensel pakete düşülür, böylece
 * güncelleme her telefonda kurulabilir kalır.
 *
 * Sıralamaya güvenilmez: GitHub varlıkları ada göre döner ve "app-..." evrenselden önce gelir.
 */
export function pickApkAsset<T extends { name: string; browser_download_url: string }>(
  assets: T[] | undefined,
  abi?: string
): T | undefined {
  const byName = (name: string) => assets?.find((a) => a.name.toLowerCase() === name);
  if (isSupportedAbi(abi)) {
    const split = byName(`app-${abi}-release.apk`);
    if (split) return split;
  }
  return byName("otopiyasa-release.apk") ?? assets?.find((a) => a.name.toLowerCase().endsWith(".apk"));
}

export function parseRelease(
  release: {
    tag_name?: string;
    body?: string | null;
    published_at?: string;
    assets?: Array<{ name: string; browser_download_url: string }>;
  },
  options: { abi?: string } = {}
): AppVersion | null {
  const body = release.body ?? "";
  const code = Number(/versionCode\s*[:=]\s*(\d+)/i.exec(body)?.[1]);
  const apk = pickApkAsset(release.assets, options.abi);
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
