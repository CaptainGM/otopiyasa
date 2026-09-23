import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apkUrl =
    process.env.APP_APK_URL ||
    "https://github.com/CaptainGM/otopiyasa/releases/latest/download/otopiyasa-release.apk";
  return NextResponse.redirect(apkUrl, 307);
}
