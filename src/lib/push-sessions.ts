import { Session } from "@/models/Session";
import { FcmToken } from "@/models/FcmToken";
import { PushSubscription } from "@/models/PushSubscription";

/**
 * BİLDİRİM GÜVENLİĞİ: bir cihaza bildirim yalnızca o cihazdaki oturum hâlâ açıkken gider. Cihaz jetonu (FCM) ve
 * tarayıcı aboneliği kaydedildiği oturumla (JWT `jti`) saklanır; çıkış yapılınca, oturum "Cihazlarım"dan
 * kapatılınca, şifre sıfırlanınca ya da süresi dolunca o cihaza hiçbir bildirim (yönetici uyarıları, teklif,
 * mesaj) gitmez. Eskiden jeton hesaba bağlı kalıyordu: çıkış yapılan telefon yönetici bildirimlerini almaya devam ediyordu.
 */

/** JWT ömrü (bkz. lib/auth.ts setExpirationTime). */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Verilen oturum kimliklerinden hâlâ açık olanlar. */
export async function activeSessionJtis(jtis: string[], now = new Date()): Promise<Set<string>> {
  const unique = [...new Set(jtis.filter(Boolean))];
  if (unique.length === 0) return new Set();
  const rows = await Session.find({
    jti: { $in: unique },
    revokedAt: null,
    createdAt: { $gte: new Date(now.getTime() - SESSION_TTL_MS) },
  })
    .select("jti")
    .lean<Array<{ jti: string }>>();
  return new Set(rows.map((r) => r.jti));
}

/** Oturumu kapanan cihazların jetonlarını ve tarayıcı aboneliklerini siler. */
export async function forgetPushForSessions(jtis: string[]): Promise<void> {
  const list = jtis.filter(Boolean);
  if (list.length === 0) return;
  await Promise.all([FcmToken.deleteMany({ jti: { $in: list } }), PushSubscription.deleteMany({ jti: { $in: list } })]);
}

/**
 * Gönderimden önce: oturumu açık olmayan (ya da oturum bilgisi olmayan eski) kayıtları ayıklar ve siler.
 * Eski kayıtlar uygulama açıldığında oturumla yeniden kaydedilir.
 */
export async function keepActiveRecipients<T extends { jti?: string | null }>(
  rows: T[],
  remove: (dead: T[]) => Promise<unknown>
): Promise<T[]> {
  const active = await activeSessionJtis(rows.map((r) => r.jti || ""));
  const alive = rows.filter((r) => r.jti && active.has(r.jti));
  const dead = rows.filter((r) => !r.jti || !active.has(r.jti));
  if (dead.length > 0) await remove(dead).catch(() => {});
  return alive;
}
