import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Web'den APK indirme yönlendirmesi (otopiyasa.app/indir).
 *
 * Burada bilinçli olarak EVRENSEL pakete gidilir: tarayıcı isteği cihazın işlemci mimarisini
 * güvenilir biçimde bildirmez, yanlış mimarideki paket ise kurulamaz. Uygulama içi güncelleme
 * mimariyi native taraftan öğrenip sunucudan küçük paketi ister (bkz. src/app/api/app-version,
 * mobile/lib/services/device_abi.dart); yani boyut kazancı asıl orada kullanılır.
 */
export async function GET() {
  const apkUrl =
    process.env.APP_APK_URL ||
    "https://github.com/CaptainGM/otopiyasa/releases/latest/download/otopiyasa-release.apk";
  return NextResponse.redirect(apkUrl, 307);
}
