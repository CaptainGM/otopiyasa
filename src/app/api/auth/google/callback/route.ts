import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { authCookies, createSessionAndToken, verifyPurposeToken } from "@/lib/auth";
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_COOKIE_PATH,
  GOOGLE_STATE_PURPOSE,
  exchangeGoogleCode,
  googleConfig,
  googleRedirectUri,
  safeNextPath,
  verifyGoogleIdToken,
} from "@/lib/google-auth";
import { GoogleAccountConflictError, findOrLinkGoogleUser } from "@/lib/google-account";

function clearStateCookie(response: NextResponse) {
  response.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: GOOGLE_STATE_COOKIE_PATH });
  return response;
}

/** Hata kodu giriş sayfasında gösterilir (bkz. components/AuthForm.tsx). */
function failure(origin: string, code: string) {
  return clearStateCookie(NextResponse.redirect(new URL(`/login?error=${code}`, origin)));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  const config = googleConfig();
  if (!config) return failure(origin, "google_disabled");
  // Kullanıcı Google ekranında vazgeçtiyse (error=access_denied).
  if (url.searchParams.get("error")) return failure(origin, "google_cancel");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const stored = await verifyPurposeToken(
    cookieStore.get(GOOGLE_STATE_COOKIE)?.value,
    GOOGLE_STATE_PURPOSE
  );
  if (!code || !state || !stored || stored.state !== state) {
    return failure(origin, "google_state");
  }

  let profile;
  try {
    const idToken = await exchangeGoogleCode(code, config, googleRedirectUri());
    profile = await verifyGoogleIdToken(idToken, config.clientId);
  } catch (error) {
    console.error("Google girişi doğrulanamadı:", error);
    return failure(origin, "google");
  }

  try {
    await connectDB();
    const user = await findOrLinkGoogleUser(profile);
    const token = await createSessionAndToken(
      {
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role || "user",
      },
      request
    );
    const next = safeNextPath(typeof stored.next === "string" ? stored.next : "/");
    const response = clearStateCookie(NextResponse.redirect(new URL(next, origin)));
    for (const cookie of authCookies(token)) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    return response;
  } catch (error) {
    if (error instanceof GoogleAccountConflictError) return failure(origin, "google_conflict");
    console.error("Google girişi tamamlanamadı:", error);
    return failure(origin, "google");
  }
}
