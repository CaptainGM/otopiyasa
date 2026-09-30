import { randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Session } from "@/models/Session";
import { User } from "@/models/User";
import { connectDB } from "@/lib/mongodb";
import { deviceLabelFromUserAgent } from "@/lib/device-label";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error(
    "JWT_SECRET ortam değişkeni tanımlı değil. Production'da zorunludur."
  );
}
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const secret = new TextEncoder().encode(JWT_SECRET);
const COOKIE_NAME = "auth_token";

export interface AuthPayload {
  userId: string;
  email: string;
  name: string;
  role: "user" | "admin";
  // Oturum kimliği, tüm doğrulanmış API erişimlerinde iptal denetimi için.
  jti?: string;
}

export async function createToken(payload: AuthPayload) {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    jti: payload.jti,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

/**
 * Girişte kullanılır: yeni bir cihaz kaydı (Session) açar ve o kaydın
 * jti'sini taşıyan bir token döner. Böylece kullanıcı /profile'da bu
 * cihazı görüp uzaktan çıkış yaptırabilir.
 */
export async function createSessionAndToken(
  payload: Omit<AuthPayload, "jti">,
  request: Request
): Promise<string> {
  const jti = randomUUID();
  const userAgent = request.headers.get("user-agent") || "";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";
  try {
    await connectDB();
    await Session.create({
      userId: payload.userId,
      jti,
      deviceLabel: deviceLabelFromUserAgent(userAgent),
      userAgent,
      ip,
    });
  } catch (error) {
    // Sessionless tokens cannot be revoked, so never issue one as a fallback.
    console.error("Oturum kaydı oluşturulamadı:", error);
    throw new Error("Güvenli oturum oluşturulamadı.", { cause: error });
  }
  return createToken({ ...payload, jti });
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as AuthPayload;
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<AuthPayload | null> {
  return getCurrentUserStrict();
}

/**
 * The shared navbar only needs identity and role claims to render its links.
 * Full database-backed revocation checks remain mandatory in protected pages
 * and API routes; avoiding those reads here keeps every public route change
 * from waiting on two extra MongoDB lookups.
 */
export async function getNavbarUser(): Promise<AuthPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.jti || !payload.userId || !payload.name || !payload.email) return null;
  if (payload.role !== "user" && payload.role !== "admin") return null;
  return payload;
}

/**
 * Verify the JWT and its revocable database session for every authenticated
 * request. The database is authoritative for the account role and existence.
 */
export async function getCurrentUserStrict(): Promise<AuthPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  // Older tokens without a session id cannot be revoked. Require a fresh login.
  if (!payload.jti) return null;

  try {
    await connectDB();
    const [session, account] = await Promise.all([
      Session.findOne({ jti: payload.jti, userId: payload.userId })
        .select("revokedAt")
        .lean<{ revokedAt: Date | null }>(),
      User.findById(payload.userId).select("role name email").lean<{
        role?: "user" | "admin";
        name?: string;
        email?: string;
      } | null>(),
    ]);
    if (!session || session.revokedAt || !account) return null;

    Session.updateOne(
      { jti: payload.jti },
      { $set: { lastSeenAt: new Date() } }
    ).catch(() => {});

    return {
      ...payload,
      role: account.role === "admin" ? "admin" : "user",
      name: account.name || payload.name,
      email: account.email || payload.email,
    };
  } catch {
    // Fail closed on database errors: revocation status cannot be trusted.
    return null;
  }
}
export async function requireAdmin(): Promise<AuthPayload | null> {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}
