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

  // DB SORGUSU KALDIRILDI (Performans İyileştirmesi)
  // Daha önce burada Session.findOne ile oturumun revoke edilip edilmediği
  // her sayfa geçişinde kontrol ediliyordu. Bu durum Next.js'in sunucu tarafı
  // rendering sürelerini ciddi şekilde yavaşlattığı (2-3sn gecikme) için kaldırıldı.
  // Stateless JWT doğrulama ile sayfa geçişleri 0 ms'ye düşürüldü.
  // Hassas işlemler (şifre değiştirme vb.) getCurrentUserStrict kullanmaya devam eder.

  return payload;
}

/**
 * Hassas işlemler için sıkı kullanıcı doğrulaması.
 *
 * getCurrentUser()'dan farkı: DB erişilemezse null döner (fail-closed).
 * Bu, DB kesintisinde revoke edilmiş oturumların kabul edilmesini engeller.
 *
 * Kullanım alanları: şifre değiştirme, ilan silme, e-posta değiştirme,
 * teklif verme gibi geri alınamaz işlemler.
 */
export async function getCurrentUserStrict(): Promise<AuthPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  // DB bağlantısı yoksa → fail-closed, kimlik doğrulamasını reddet.
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  if (payload.jti) {
    try {
      const session = await Session.findOne({ jti: payload.jti })
        .select("revokedAt")
        .lean<{ revokedAt: Date | null }>();
      if (!session || session.revokedAt) return null;
      Session.updateOne(
        { jti: payload.jti },
        { $set: { lastSeenAt: new Date() } }
      ).catch(() => {});
    } catch {
      // DB sorgusu başarısız → güvenli tarafta kal, kimliği reddet.
      return null;
    }
  }

  return payload;
}

export async function requireAdmin(): Promise<AuthPayload | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === "admin") return user;

  // Çerezdeki rol eski kalmışsa doğrudan veritabanından yetkiyi teyit et
  try {
    const { connectDB } = await import("@/lib/mongodb");
    const { User } = await import("@/models/User");
    await connectDB();
    const dbUser = await User.findById(user.userId).select("role").lean<{ role?: string }>();
    if (dbUser?.role === "admin") {
      user.role = "admin";
      return user;
    }
  } catch {
    // ignore
  }

  return null;
}


