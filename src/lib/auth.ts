import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Session } from "@/models/Session";
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
  // Oturum kimliği — cihaz listesi/uzaktan çıkış için. Bu alan eklenmeden
  // ÖNCE verilmiş eski token'larda yok; getCurrentUser bu durumu bilerek
  // atlar (mevcut girişleri zorla kapatmaz, doğal süresi dolunca biter).
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
    await Session.create({
      userId: payload.userId,
      jti,
      deviceLabel: deviceLabelFromUserAgent(userAgent),
      userAgent,
      ip,
    });
  } catch (error) {
    // Cihaz kaydı başarısız olsa bile giriş engellenmesin — jti'siz devam.
    console.error("Oturum kaydı oluşturulamadı:", error);
    return createToken(payload);
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
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  // jti'si olmayan (bu özellikten önce verilmiş) token'lar kontrolsüz geçer —
  // mevcut girişleri zorla kapatmayız. DB bağlı değilse de aynı şekilde
  // güvenli tarafta kal (fail-open): sayfa gösterimi DB'ye bağımlı olmasın.
  if (payload.jti && mongoose.connection.readyState === 1) {
    try {
      const session = await Session.findOne({ jti: payload.jti })
        .select("revokedAt")
        .lean<{ revokedAt: Date | null }>();
      if (!session || session.revokedAt) return null;
      Session.updateOne(
        { jti: payload.jti },
        { $set: { lastSeenAt: new Date() } }
      ).catch(() => {});
    } catch (error) {
      console.error("Oturum doğrulaması kontrol edilemedi:", error);
    }
  }

  return payload;
}

export async function requireAdmin(): Promise<AuthPayload | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}


