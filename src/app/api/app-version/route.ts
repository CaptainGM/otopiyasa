import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const version = process.env.APP_LATEST_VERSION || "1.0.2";
  const versionCode = parseInt(process.env.APP_LATEST_VERSION_CODE || "3", 10);
  const minVersionCode = parseInt(process.env.APP_MIN_VERSION_CODE || "1", 10);
  const apkUrl =
    process.env.APP_APK_URL ||
    "https://github.com/CaptainGM/otopiyasa/releases/latest/download/otopiyasa-release.apk";

  const changelog =
    process.env.APP_CHANGELOG ||
    "• Üst menü düzeni yenilendi: Tema butonu açıldı, profil butonu en sağa taşındı.\n" +
    "• Marka ve model seçimlerine anlık arama (klavyeyle hızlı filtreleme) eklendi.\n" +
    "• Benzer ilanlar 8 araca çıkarıldı ve alt alta dikey liste olarak güncellendi.\n" +
    "• Paylaşılan ilan bağlantılarına tıklandığında doğrudan uygulamanın açılması (Deep Link) sağlandı.\n" +
    "• İlan detayları, piyasa termometresi ve emsal sorguları hızlandırıldı.";

  return NextResponse.json(
    {
      version,
      versionCode,
      minVersionCode,
      apkUrl,
      title: "OtoPiyasa Güncellemesi Hazır! 🚀",
      changelog,
      releaseDate: "2026-09-25",
      forceUpdate: false,
    },
    {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}
