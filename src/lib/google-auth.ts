import { randomBytes } from "crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { appBaseUrl } from "@/lib/app-url";

/** Google girişinde CSRF durumunu taşıyan çerez (yalnızca geri dönüş yolunda gönderilir). */
export const GOOGLE_STATE_COOKIE = "google_oauth";
/** Durum çerezi yalnızca Google girişi uçlarına gönderilir. */
export const GOOGLE_STATE_COOKIE_PATH = "/api/auth/google";
export const GOOGLE_STATE_PURPOSE = "google-oauth";
export const GOOGLE_STATE_TTL = "10m";
export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";
/**
 * Mobil uygulamadan başlatılan girişin dönüş adresi. Android App Link olarak doğrulanmıştır
 * (AndroidManifest.xml), bu yola gidilince bağlantı doğrudan uygulamayı açar.
 */
export const GOOGLE_APP_RETURN_PATH = "/mobil-giris";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

const googleKeys = createRemoteJWKSet(new URL(JWKS_URL));

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

/** Ortam değişkenleri yoksa null: düğme gösterilmez, giriş uçları devre dışı kalır. */
export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function isGoogleConfigured(): boolean {
  return googleConfig() !== null;
}

/** Google Cloud'da kayıtlı yönlendirme adresiyle birebir aynı olmalı. */
export function googleRedirectUri(): string {
  return `${appBaseUrl()}${GOOGLE_CALLBACK_PATH}`;
}

export function newOauthState(): string {
  return randomBytes(24).toString("base64url");
}

/** Giriş sonrası dönülecek adres: yalnız site içi göreli yollar; açık yönlendirmeyi (//evil.com) engeller. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

export function buildGoogleAuthUrl(config: GoogleConfig, state: string, redirectUri: string): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  // Birden fazla Google hesabı olan kullanıcı her seferinde hangisiyle girdiğini seçsin.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

/** Yetkilendirme kodunu kimlik belirtecine çevirir (sunucudan sunucuya; istemci sırrı burada kullanılır). */
export async function exchangeGoogleCode(
  code: string,
  config: GoogleConfig,
  redirectUri: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Google token uç noktası ${response.status} döndü`);
  const data = (await response.json()) as { id_token?: unknown };
  if (typeof data.id_token !== "string") throw new Error("Google kimlik belirteci yok");
  return data.id_token;
}

export interface GoogleProfile {
  /** Google hesabının kalıcı kimliği; e-posta değişse de aynı kalır. */
  sub: string;
  email: string;
  name: string;
}

/** İmzayı, veren kuruluşu, hedef kitleyi ve süreyi doğrular; e-posta Google tarafından onaylı olmalı. */
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  keys: JWTVerifyGetKey = googleKeys
): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(idToken, keys, { issuer: ISSUERS, audience: clientId });
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Google kimlik belirtecinde sub veya e-posta yok");
  }
  if (payload.email_verified !== true) {
    throw new Error("Google e-posta adresi doğrulanmamış");
  }
  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === "string" ? payload.name : "",
  };
}
