import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { Offer } from "@/models/Offer";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { appBaseUrl } from "@/lib/app-url";
import { createNotification } from "@/lib/notify";
import { isMailerConfigured, sendOfferDecisionEmail } from "@/lib/mailer";
import { canRespond, canSendMessage, chatExpiryFrom } from "@/lib/offers";
import { serializeOffer } from "@/lib/serialize-offer";

export const dynamic = "force-dynamic";

/** Kanalı yükler ve görüntüleyenin taraflardan biri olduğunu doğrular. */
async function loadOwnChannel(id: string, userId: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  const offer = await Offer.findById(id)
    .populate({ path: "car", model: Car, select: "title imageUrl price contactPhone _id" })
    .populate({ path: "buyer", model: User, select: "name email" })
    .populate({ path: "seller", model: User, select: "name email" });
  if (!offer) return null;

  const buyerId = offer.buyer?._id?.toString();
  const sellerId = offer.seller?._id?.toString();
  if (buyerId !== userId && sellerId !== userId) return null;
  return offer;
}

/** Kanal detayı (olay akışı dahil). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authUser = await getCurrentUser();
  if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  await connectDB();
  const { id } = await context.params;
  const offer = await loadOwnChannel(id, authUser.userId);
  if (!offer) return NextResponse.json({ error: "Kanal bulunamadı." }, { status: 404 });

  // Okundu işareti — bildirim rozetleri için.
  const isSeller = offer.seller?._id?.toString() === authUser.userId;
  if (isSeller) offer.sellerSeenAt = new Date();
  else offer.buyerSeenAt = new Date();
  await offer.save();

  return NextResponse.json({ offer: serializeOffer(offer.toObject(), authUser.userId) });
}

/**
 * Kanalda işlem yap:
 *  - `action: "accept" | "reject"` → yalnızca SATICI, yalnızca bekleyen teklifte
 *  - `action: "message"`           → yalnızca kabul edilmiş ve süresi dolmamış kanalda
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const limited = checkRateLimit(request, "offer-action", { limit: 60, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    await connectDB();
    const { id } = await context.params;
    const offer = await loadOwnChannel(id, authUser.userId);
    if (!offer) return NextResponse.json({ error: "Kanal bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    const now = new Date();
    const isSeller = offer.seller?._id?.toString() === authUser.userId;

    if (action === "accept" || action === "reject") {
      if (!isSeller) {
        return NextResponse.json({ error: "Teklifi yalnızca ilan sahibi yanıtlayabilir." }, { status: 403 });
      }
      if (!canRespond(offer.status, offer.expiresAt, now)) {
        return NextResponse.json({ error: "Bu teklif zaten yanıtlanmış." }, { status: 409 });
      }

      const accepted = action === "accept";
      offer.status = accepted ? "accepted" : "rejected";
      offer.chatEnabled = accepted;
      // 48 saatlik pencere yalnızca kabulde başlar.
      offer.expiresAt = accepted ? chatExpiryFrom(now) : null;
      offer.events.push({
        kind: accepted ? "accepted" : "rejected",
        author: authUser.userId,
        amount: offer.amount,
        createdAt: now,
      });
      offer.buyerSeenAt = null;
      await offer.save();

      await notifyBuyer(offer, accepted);
      return NextResponse.json({ status: offer.status });
    }

    if (action === "message") {
      // Serbest yazışma YALNIZCA kabul sonrası açılır; süresi dolduysa kapanır.
      if (!canSendMessage(offer.status, offer.expiresAt, now)) {
        return NextResponse.json(
          { error: "Bu kanalda mesajlaşma açık değil. Teklif kabul edildiğinde 48 saat boyunca yazışabilirsin." },
          { status: 409 }
        );
      }

      // Admin, şikayet incelemesi sonrası bu kullanıcının mesajlaşmasını geçici
      // olarak durdurmuş olabilir (bkz. api/admin/users/[id]/moderate).
      const sender = await User.findById(authUser.userId).select("chatSuspendedUntil").lean<{
        chatSuspendedUntil?: Date | null;
      }>();
      if (sender?.chatSuspendedUntil && new Date(sender.chatSuspendedUntil) > now) {
        const until = new Date(sender.chatSuspendedUntil).toLocaleString("tr-TR");
        return NextResponse.json(
          { error: `Mesajlaşman geçici olarak durduruldu (${until}'e kadar).` },
          { status: 403 }
        );
      }

      const text = String(body.text || "").trim().slice(0, 1000);
      if (!text) return NextResponse.json({ error: "Mesaj boş olamaz." }, { status: 400 });

      offer.events.push({ kind: "message", author: authUser.userId, text, createdAt: now });
      if (isSeller) offer.buyerSeenAt = null;
      else offer.sellerSeenAt = null;
      await offer.save();

      const recipient = isSeller ? offer.buyer : offer.seller;
      await createNotification({
        userId: recipient._id.toString(),
        type: "offer",
        title: `Yeni mesaj: ${offer.car?.title || "İlan"}`,
        body: text.slice(0, 120),
        link: `/offers/${offer._id.toString()}`,
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/offers/[id] error:", error);
    return NextResponse.json({ error: "İşlem tamamlanamadı." }, { status: 500 });
  }
}

/** Alıcıya karar bildirimi + e-postası. */
async function notifyBuyer(
  offer: {
    _id: { toString(): string };
    amount: number;
    buyer: { _id: { toString(): string }; email?: string };
    car?: { title?: string } | null;
  },
  accepted: boolean
) {
  const link = `/offers/${offer._id.toString()}`;
  const carTitle = offer.car?.title || "İlan";

  await createNotification({
    userId: offer.buyer._id.toString(),
    type: "offer",
    title: accepted ? `Teklifin kabul edildi: ${carTitle}` : `Teklifin reddedildi: ${carTitle}`,
    body: accepted
      ? "Satıcıyla 48 saat boyunca mesajlaşabilirsin."
      : "Dilersen yeni bir teklif gönderebilirsin.",
    link,
  });

  if (!isMailerConfigured() || !offer.buyer.email) return;
  sendOfferDecisionEmail(offer.buyer.email, {
    carTitle,
    amount: offer.amount,
    accepted,
    url: `${appBaseUrl()}${link}`,
  }).catch((e) => console.warn("sendOfferDecisionEmail failed:", e));
}
