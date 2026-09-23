import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { FcmToken } from "@/models/FcmToken";



let app: App | null = null;
let attempted = false;

export function isFcmConfigured(): boolean {
  return Boolean(process.env.FCM_SERVICE_ACCOUNT_JSON);
}

function getApp(): App | null {
  if (attempted) return app;
  attempted = true;
  if (!isFcmConfigured()) return null;

  try {
    const serviceAccount = JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON as string);
    app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
  } catch (error) {
    console.error("FCM service account ayrıştırılamadı:", error);
    app = null;
  }
  return app;
}

export interface FcmPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendFcmToUsers(
  userIds: Array<{ toString(): string }>,
  payload: FcmPayload
): Promise<number> {
  const fcmApp = getApp();
  if (!fcmApp || userIds.length === 0) return 0;

  const tokens = await FcmToken.find({ userId: { $in: userIds } }).lean<
    { token: string }[]
  >();
  if (tokens.length === 0) return 0;

  const response = await getMessaging(fcmApp).sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title: payload.title, body: payload.body },
    data: payload.url ? { url: payload.url } : undefined,
  });

  const dead: string[] = [];
  response.responses.forEach((r, i) => {
    if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
      dead.push(tokens[i].token);
    }
  });
  if (dead.length > 0) {
    await FcmToken.deleteMany({ token: { $in: dead } });
  }

  return response.successCount;
}
