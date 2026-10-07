/** GitHub yayınından mobil uygulama sürüm bilgisi (bkz. src/app/api/app-version/route.ts, release-apk.bat). */
export interface AppVersion {
  version: string;
  versionCode: number;
  minVersionCode: number;
  apkUrl: string;
  title: string;
  changelog: string;
  releaseDate: string;
  forceUpdate: boolean;
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
    minVersionCode: Number(process.env.APP_MIN_VERSION_CODE || "1"),
    apkUrl: apk.browser_download_url,
    title: "OtoPiyasa güncellemesi hazır",
    changelog,
    releaseDate: (release.published_at ?? "").slice(0, 10),
    forceUpdate: false,
  };
}
