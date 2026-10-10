import { NextResponse } from "next/server";
import { isSupportedAbi, minVersionCode, parseRelease, type AppVersion } from "@/lib/app-release";

export const dynamic = "force-dynamic";

/**
 * Mobil uygulamanın güncelleme denetimi (bkz. mobile/lib/services/update_service.dart). En son sürüm GitHub'daki
 * son yayından (release) okunur: yeni APK yayınlanınca ayrıca bir ayar değiştirmek gerekmez (bkz. release-apk.bat).
 * Yayın notunda `versionCode: 7` satırı olmalı (gizli yorum olarak yazılır); APK yayının eki olarak durur.
 *
 * `?abi=arm64-v8a` gibi bir parametre verilirse mimariye göre bölünmüş küçük paket (~23 MB)
 * verilir; verilmezse tüm mimarileri kapsayan evrensel paket (~65 MB) döner, böylece eski
 * sürümler ve tanınmayan mimariler güncelleme alabilmeye devam eder.
 *
 * GitHub'a ulaşılamazsa ortam değişkenleri (APP_LATEST_*) ya da son bilinen sürüm döner.
 * Yanıt 10 dk CDN'de tutulur: her açılışta GitHub'a sorulmaz (kimliksiz GitHub API sınırı saatte 60 istek).
 * Önbellek adres bazlı olduğu için abi parametresi yanıtı doğru şekilde ayırır.
 */
const REPO = "CaptainGM/otopiyasa";
const CACHE_MS = 30 * 60 * 1000;

/** Yayının ham hâli önbelleklenir; APK seçimi isteğe göre yapılır (abi başına ayrı önbellek gerekmesin). */
type Release = Parameters<typeof parseRelease>[0];

let memo: { value: Release; at: number } | null = null;

function fallback(abi?: string): AppVersion {
  const universal =
    process.env.APP_APK_URL ||
    `https://github.com/${REPO}/releases/latest/download/otopiyasa-release.apk`;
  // APP_APK_URL tanımlıysa (özel adres) mimari ayrımı yapılmaz.
  const split =
    !process.env.APP_APK_URL && isSupportedAbi(abi)
      ? `https://github.com/${REPO}/releases/latest/download/app-${abi}-release.apk`
      : universal;
  return {
    version: process.env.APP_LATEST_VERSION || "1.0.2",
    versionCode: Number(process.env.APP_LATEST_VERSION_CODE || "3"),
    minVersionCode: minVersionCode(),
    apkUrl: split,
    title: "OtoPiyasa güncellemesi hazır",
    changelog: process.env.APP_CHANGELOG || "",
    releaseDate: "",
    forceUpdate: false,
  };
}

async function latestRelease(): Promise<Release | null> {
  if (memo && Date.now() - memo.at < CACHE_MS) return memo.value;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "otopiyasa-app-version" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const release = (await res.json()) as Release;
      memo = { value: release, at: Date.now() };
      return release;
    }
  } catch {
    // GitHub'a ulaşılamadı: son bilinen yayın ya da ortam değişkenleri.
  }
  return memo?.value ?? null;
}

export async function GET(request: Request) {
  const abiParam = new URL(request.url).searchParams.get("abi") ?? undefined;
  const abi = isSupportedAbi(abiParam) ? abiParam : undefined;

  const release = await latestRelease();
  const parsed = release ? parseRelease(release, { abi }) : null;

  return NextResponse.json(parsed ?? fallback(abi), {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
  });
}
