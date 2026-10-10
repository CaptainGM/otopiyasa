import webpush from "web-push";
import { PushSubscription } from "@/models/PushSubscription";
import { keepActiveRecipients } from "@/lib/push-sessions";
import { sendFcmToUsers } from "@/lib/fcm";
import { absolutePushUrl } from "@/lib/push-url";

let configured = false;


export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

function ensureConfigured() {
  if (configured || !isPushConfigured()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@otopiyasa.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToUsers(
  userIds: Array<{ toString(): string }>,
  payload: PushPayload
): Promise<number> {
  // Adres mutlaklaştırılır: mobil uygulama göreli yolu açamaz (bkz. lib/push-url.ts).
  const normalized: PushPayload = { ...payload, url: absolutePushUrl(payload.url) };
  const [webSent, fcmSent] = await Promise.all([
    sendWebPushToUsers(userIds, normalized),
    sendFcmToUsers(userIds, normalized).catch((error) => {
      console.error("FCM gönderimi başarısız:", error);
      return 0;
    }),
  ]);
  return webSent + fcmSent;
}

async function sendWebPushToUsers(
  userIds: Array<{ toString(): string }>,
  payload: PushPayload
): Promise<number> {
  if (!isPushConfigured() || userIds.length === 0) return 0;
  ensureConfigured();

  // Yalnızca oturumu hâlâ açık tarayıcılar (bkz. lib/push-sessions.ts).
  const subs = await keepActiveRecipients(
    await PushSubscription.find({ userId: { $in: userIds } }).lean<
      { _id: unknown; endpoint: string; keys: { p256dh: string; auth: string }; jti?: string | null }[]
    >(),
    (dead) => PushSubscription.deleteMany({ endpoint: { $in: dead.map((d) => d.endpoint) } })
  );
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body
        );
        sent += 1;
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) dead.push(sub.endpoint);
        else console.error("Push gönderilemedi:", statusCode || error);
      }
    })
  );

  if (dead.length > 0) {
    await PushSubscription.deleteMany({ endpoint: { $in: dead } });
  }
  return sent;
}
