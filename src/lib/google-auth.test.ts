import { describe, expect, it, vi } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type KeyLike } from "jose";
import { signPurposeToken, verifyPurposeToken } from "@/lib/auth";
import { buildGoogleAuthUrl, safeNextPath, verifyGoogleIdToken } from "@/lib/google-auth";

// auth.ts içe aktarılınca veritabanı modülü yüklenir; bu testler veritabanına dokunmaz.
vi.mock("@/lib/mongodb", () => ({ connectDB: async () => {} }));

const CLIENT_ID = "test-client.apps.googleusercontent.com";

async function googleKeySet() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  return { keys: createLocalJWKSet({ keys: [jwk] }), privateKey };
}

function idToken(
  privateKey: KeyLike,
  claims: Record<string, unknown> = {},
  overrides: { issuer?: string; audience?: string; expiresAt?: number } = {}
) {
  return new SignJWT({ email: "ada@example.com", email_verified: true, name: "Ada Lovelace", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(overrides.issuer ?? "https://accounts.google.com")
    .setAudience(overrides.audience ?? CLIENT_ID)
    .setSubject("1234567890")
    .setIssuedAt()
    .setExpirationTime(overrides.expiresAt ?? "1h")
    .sign(privateKey);
}

describe("safeNextPath", () => {
  it("site içi göreli yolu korur", () => {
    expect(safeNextPath("/ilanlar?sayfa=2")).toBe("/ilanlar?sayfa=2");
  });

  it("dış adresleri ve protokol-göreli yolları ana sayfaya çevirir", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
});

describe("buildGoogleAuthUrl", () => {
  it("OIDC parametrelerini doğru kurar", () => {
    const url = new URL(
      buildGoogleAuthUrl(
        { clientId: CLIENT_ID, clientSecret: "x" },
        "durum-1",
        "https://otopiyasa.app/api/auth/google/callback"
      )
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe("https://otopiyasa.app/api/auth/google/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("durum-1");
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });
});

describe("verifyGoogleIdToken", () => {
  it("geçerli belirteçten hesap kimliğini ve adı döner", async () => {
    const { keys, privateKey } = await googleKeySet();
    const profile = await verifyGoogleIdToken(await idToken(privateKey), CLIENT_ID, keys);
    expect(profile).toEqual({ sub: "1234567890", email: "ada@example.com", name: "Ada Lovelace" });
  });

  it("başka uygulama için üretilmiş belirteci reddeder (audience)", async () => {
    const { keys, privateKey } = await googleKeySet();
    await expect(
      verifyGoogleIdToken(await idToken(privateKey, {}, { audience: "baska-uygulama" }), CLIENT_ID, keys)
    ).rejects.toThrow();
  });

  it("Google dışı veren kuruluşu reddeder (issuer)", async () => {
    const { keys, privateKey } = await googleKeySet();
    await expect(
      verifyGoogleIdToken(await idToken(privateKey, {}, { issuer: "https://evil.example" }), CLIENT_ID, keys)
    ).rejects.toThrow();
  });

  it("süresi dolmuş belirteci reddeder", async () => {
    const { keys, privateKey } = await googleKeySet();
    const past = Math.floor(Date.now() / 1000) - 60;
    await expect(
      verifyGoogleIdToken(await idToken(privateKey, {}, { expiresAt: past }), CLIENT_ID, keys)
    ).rejects.toThrow();
  });

  it("e-posta Google tarafından doğrulanmamışsa reddeder", async () => {
    const { keys, privateKey } = await googleKeySet();
    await expect(
      verifyGoogleIdToken(await idToken(privateKey, { email_verified: false }), CLIENT_ID, keys)
    ).rejects.toThrow("doğrulanmamış");
  });
});

describe("imzalı durum belirteci", () => {
  it("doğru amaçla geri okunur", async () => {
    const token = await signPurposeToken({ state: "abc", next: "/favoriler" }, "google-oauth", "10m");
    const payload = await verifyPurposeToken(token, "google-oauth");
    expect(payload?.state).toBe("abc");
    expect(payload?.next).toBe("/favoriler");
  });

  it("başka amaç, eksik ya da bozulmuş belirteç kabul edilmez", async () => {
    const token = await signPurposeToken({ state: "abc" }, "google-oauth", "10m");
    expect(await verifyPurposeToken(token, "baska-amac")).toBeNull();
    expect(await verifyPurposeToken(undefined, "google-oauth")).toBeNull();
    expect(await verifyPurposeToken(token.slice(0, -2) + "xx", "google-oauth")).toBeNull();
  });
});
