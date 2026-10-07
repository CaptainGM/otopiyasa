import { NextResponse } from "next/server";
import { parseRelease, type AppVersion } from "@/lib/app-release";

export const dynamic = "force-dynamic";

/**
 * Mobil uygulamanın güncelleme denetimi (bkz. mobile/lib/services/update_service.dart). En son sürüm GitHub'daki
 * son yayından (release) okunur: yeni APK yayınlanınca ayrıca bir ayar değiştirmek gerekmez (bkz. release-apk.bat).
 * Yayın notunda `versionCode: 7` satırı olmalı (gizli yorum olarak yazılır); APK yayının eki olarak durur.
 * GitHub'a ulaşılamazsa ortam değişkenleri (APP_LATEST_*) ya da son bilinen sürüm döner.
 * Yanıt 10 dk CDN'de tutulur: her açılışta GitHub'a sorulmaz (kimliksiz GitHub API sınırı saatte 60 istek).
 */
const REPO = "CaptainGM/otopiyasa";
const CACHE_MS = 30 * 60 * 1000;

let memo: { value: AppVersion; at: number } | null = null;

function fallback(): AppVersion {
  return {
    version: process.env.APP_LATEST_VERSION || "1.0.2",
    versionCode: Number(process.env.APP_LATEST_VERSION_CODE || "3"),
    minVersionCode: Number(process.env.APP_MIN_VERSION_CODE || "1"),
    apkUrl:
      process.env.APP_APK_URL ||
      `https://github.com/${REPO}/releases/latest/download/otopiyasa-release.apk`,
    title: "OtoPiyasa güncellemesi hazır",
    changelog: process.env.APP_CHANGELOG || "",
    releaseDate: "",
    forceUpdate: false,
  };
}

async function latest(): Promise<AppVersion> {
  if (memo && Date.now() - memo.at < CACHE_MS) return memo.value;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "otopiyasa-app-version" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const parsed = parseRelease(await res.json());
      if (parsed) {
        memo = { value: parsed, at: Date.now() };
        return parsed;
      }
    }
  } catch {
    // GitHub'a ulaşılamadı: son bilinen sürüm ya da ortam değişkenleri.
  }
  return memo?.value ?? fallback();
}

export async function GET() {
  return NextResponse.json(await latest(), {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
  });
}
