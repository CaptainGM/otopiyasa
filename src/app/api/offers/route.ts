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
import { isMailerConfigured, sendNewOfferEmail } from "@/lib/mailer";
import { validateOfferAmount, canSubmitNewOffer, effectiveStatus } from "@/lib/offers";
import { serializeOffer, type LeanOffer } from "@/lib/serialize-offer";

export const dynamic = "force-dynamic";

/**
 * Kullanıcının pazarlık kanalları — hem ALICI hem SATICI tarafı.
 * `role=buying` / `role=selling` ile filtrelenebilir.
 */
export async function GET(request: Request) {
  const authUser = await getCurrentUser();
  if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  await connectDB();
  const role = new URL(request.url).searchParams.get("role");
  const filter =
    role === "buying"
      ? { buyer: authUser.userId }
      : role === "selling"
        ? { seller: authUser.userId }
        : { $or: [{ buyer: authUser.userId }, { seller: authUser.userId }] };

  const offers = (await Offer.find(filter)
    .sort({ updatedAt: -1 })
    .limit(100)
    .populate({ path: "car", model: Car, select: "title imageUrl price contactPhone _id" })
    .populate({ path: "buyer", model: User, select: "name" })
    .populate({ path: "seller", model: User, select: "name" })
    .lean()) as unknown as LeanOffer[];

  return NextResponse.json({
    items: offers.map((o) => serializeOffer(o, authUser.userId)),
  });
}

/**
 * Teklif ver (ya da reddedilen/süresi dolmuş bir kanala YENİ teklif ekle).
 *
 * Yalnızca ÜYE ilanlarında geçerli: derlenen ilanların satıcısı sitede kayıtlı
 * olmadığı için iletilecek bir muhatap yok.
 */
export async function POST(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const limited = checkRateLimit(request, "offer", { limit: 20, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const carId = String(body.carId || "");
    const amount = Number(body.amount);

    if (!Types.ObjectId.isValid(carId)) {
      return NextResponse.json({ error: "Geçersiz ilan." }, { status: 400 });
    }

    await connectDB();
    const car = await Car.findById(carId).select("title price ownerId sourceSite moderationStatus minOffer status").lean<{
      _id: Types.ObjectId; title: string; price: number;
      ownerId?: Types.ObjectId; sourceSite?: string; moderationStatus?: string; minOffer?: number;
      status?: string;
    }>();

    if (!car) return NextResponse.json({ error: "İlan bulunamadı." }, { status: 404 });
    if (car.sourceSite !== "user" || !car.ownerId) {
      return NextResponse.json(
        { error: "Bu ilan bir referans kaydı; yalnızca üyelerin verdiği ilanlara teklif verilebilir." },
        { status: 400 }
      );
    }
    if (car.moderationStatus === "pending" || car.moderationStatus === "rejected") {
      return NextResponse.json({ error: "Bu ilan şu anda yayında değil." }, { status: 400 });
    }
    if (car.status && car.status !== "active") {
      return NextResponse.json(
        { error: car.status === "sold" ? "Bu ilan satıldı olarak işaretlenmiş, teklif verilemez." : "Bu ilan artık mevcut değil." },
        { status: 400 }
      );
    }
    if (car.ownerId.toString() === authUser.userId) {
      return NextResponse.json({ error: "Kendi ilanına teklif veremezsin." }, { status: 400 });
    }

    const check = validateOfferAmount(amount, car.price, car.minOffer);
    if (!check.valid) return NextResponse.json({ error: check.error }, { status: 400 });

    const now = new Date();
    const existing = await Offer.findOne({ car: carId, buyer: authUser.userId });

    if (existing) {
      // Bekleyen ya da kabul edilmiş kanala üst üste teklif yığmayı engelle.
      if (!canSubmitNewOffer(existing.status, existing.expiresAt, now)) {
        const real = effectiveStatus(existing.status, existing.expiresAt, now);
        return NextResponse.json(
          {
            error:
              real === "pending"
                ? "Bu ilan için zaten yanıt bekleyen bir teklifin var."
                : "Bu ilan için teklifin kabul edilmiş durumda.",
          },
          { status: 409 }
        );
      }
      existing.amount = amount;
      existing.status = "pending";
      existing.chatEnabled = false;
      existing.expiresAt = null;
      existing.events.push({ kind: "offer", author: authUser.userId, amount, createdAt: now });
      existing.sellerSeenAt = null;
      await existing.save();
      await notifySeller(existing._id.toString(), car, authUser, amount);
      return NextResponse.json({ id: existing._id.toString(), status: "pending", renewed: true });
    }

    const created = await Offer.create({
      car: carId,
      buyer: authUser.userId,
      seller: car.ownerId,
      amount,
      status: "pending",
      events: [{ kind: "offer", author: authUser.userId, amount, createdAt: now }],
    });

    await notifySeller(created._id.toString(), car, authUser, amount);
    return NextResponse.json({ id: created._id.toString(), status: "pending" });
  } catch (error) {
    console.error("POST /api/offers error:", error);
    return NextResponse.json({ error: "Teklif gönderilemedi." }, { status: 500 });
  }
}

/** Satıcıya bildirim + e-posta (best-effort; teklif akışını bloklamaz). */
async function notifySeller(
  offerId: string,
  car: { _id: Types.ObjectId; title: string; ownerId?: Types.ObjectId },
  buyer: { userId: string; name: string },
  amount: number
) {
  const link = `/offers/${offerId}`;
  const pretty = amount.toLocaleString("tr-TR");

  await createNotification({
    userId: car.ownerId!.toString(),
    type: "offer",
    title: `Yeni teklif: ${car.title}`,
    body: `${buyer.name} ${pretty} ₺ teklif verdi.`,
    link,
  });

  if (!isMailerConfigured()) return;
  const seller = await User.findById(car.ownerId).select("email").lean<{ email: string }>();
  if (!seller?.email) return;

  sendNewOfferEmail(seller.email, {
    carTitle: car.title,
    buyerName: buyer.name,
    amount,
    url: `${appBaseUrl()}${link}`,
  }).catch((e) => console.warn("sendNewOfferEmail failed:", e));
}
