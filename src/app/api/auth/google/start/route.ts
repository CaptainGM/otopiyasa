import { NextResponse } from "next/server";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";
import { signPurposeToken } from "@/lib/auth";
import {
  GOOGLE_APP_RETURN_PATH,
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_COOKIE_PATH,
  GOOGLE_STATE_PURPOSE,
  GOOGLE_STATE_TTL,
  buildGoogleAuthUrl,
  googleConfig,
  googleRedirectUri,
  newOauthState,
  safeNextPath,
} from "@/lib/google-auth";

export async function GET(request: Request) {
  const limited = await checkSharedRateLimit(request, "google-start", { limit: 30 });
  if (limited) return limited;

  const url = new URL(request.url);
  const origin = url.origin;
  // Mobil uygulama tarayıcıyı bu adresle açar (app=1); sonuç uygulamaya bilet olarak döner.
  const appMode = url.searchParams.get("app") === "1";
  const config = googleConfig();
  if (!config) {
    const target = appMode ? `${GOOGLE_APP_RETURN_PATH}?hata=google_disabled` : "/login?error=google_disabled";
    return NextResponse.redirect(new URL(target, origin));
  }

  const next = safeNextPath(url.searchParams.get("next"));
  const state = newOauthState();
  // Durum ve dönüş adresi imzalı bir çerezde: geri dönüşte karşılaştırılır (CSRF) ve sunucuda saklanmaz.
  const stateToken = await signPurposeToken(
    { state, next, app: appMode },
    GOOGLE_STATE_PURPOSE,
    GOOGLE_STATE_TTL
  );

  const response = NextResponse.redirect(buildGoogleAuthUrl(config, state, googleRedirectUri()));
  response.cookies.set(GOOGLE_STATE_COOKIE, stateToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: GOOGLE_STATE_COOKIE_PATH,
    maxAge: 60 * 10,
  });
  return response;
}
