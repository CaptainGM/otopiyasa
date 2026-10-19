import { createHash, randomBytes } from "crypto";
import { connectDB } from "@/lib/mongodb";
import { GoogleLoginTicket } from "@/models/GoogleLoginTicket";

/** Bilet bir dakika geçerli; uygulama açılıp hemen harcanması beklenir. */
export const GOOGLE_TICKET_TTL_MS = 60_000;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Kullanıcı için tek kullanımlık, kısa süreli bir kod üretir. Ham kod yalnızca bu yanıtta görünür. */
export async function issueGoogleLoginTicket(userId: string): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  await connectDB();
  await GoogleLoginTicket.create({
    codeHash: hashCode(code),
    userId,
    expiresAt: new Date(Date.now() + GOOGLE_TICKET_TTL_MS),
  });
  return code;
}

/**
 * Kodu bir kez harcar. Atomik güncelleme sayesinde aynı kod iki istekte birden kullanılamaz.
 * Kod yanlış, kullanılmış ya da süresi dolmuşsa null döner.
 */
export async function consumeGoogleLoginTicket(code: string): Promise<string | null> {
  if (!code || code.length > 128) return null;
  await connectDB();
  const ticket = await GoogleLoginTicket.findOneAndUpdate(
    { codeHash: hashCode(code), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } }
  ).lean<{ userId: unknown } | null>();
  return ticket ? String(ticket.userId) : null;
}
