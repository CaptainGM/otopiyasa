import { NextResponse } from "next/server";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";
import { signPurposeToken } from "@/lib/auth";
import {
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

  const origin = new URL(request.url).origin;
  const config = googleConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/login?error=google_disabled", origin));
  }

  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  const state = newOauthState();
  // Durum ve dönüş adresi imzalı bir çerezde: geri dönüşte karşılaştırılır (CSRF) ve sunucuda saklanmaz.
  const stateToken = await signPurposeToken({ state, next }, GOOGLE_STATE_PURPOSE, GOOGLE_STATE_TTL);

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
