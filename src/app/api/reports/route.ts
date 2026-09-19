import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { Offer } from "@/models/Offer";
import { Report, REPORT_REASONS } from "@/models/Report";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { createNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

const CHAT_SNAPSHOT_EVENT_COUNT = 20;

interface OfferLean {
  _id: Types.ObjectId;
  car: Types.ObjectId;
  buyer: Types.ObjectId;
  seller: Types.ObjectId;
  events: {
    kind: string;
    author?: Types.ObjectId | null;
    text?: string;
    amount?: number | null;
    createdAt?: Date;
  }[];
}

/** Şikayet anındaki son mesajların düz metin özeti — admin canlı sohbete erişmez, yalnızca bunu görür. */
function buildChatSnapshot(offer: OfferLean, buyerName: string, sellerName: string): string {
  const events = offer.events.slice(-CHAT_SNAPSHOT_EVENT_COUNT);
  return events
    .map((e) => {
      const who = e.author?.toString() === offer.buyer.toString() ? buyerName : sellerName;
      const when = e.createdAt ? new Date(e.createdAt).toLocaleString("tr-TR") : "";
      if (e.kind === "message") return `[${when}] ${who}: ${e.text}`;
      if (e.kind === "offer") return `[${when}] ${who} teklif verdi: ${e.amount} ₺`;
      if (e.kind === "accepted") return `[${when}] Teklif kabul edildi`;
      if (e.kind === "rejected") return `[${when}] Teklif reddedildi`;
      return `[${when}] (sistem olayı)`;
    })
    .join("\n");
}

/** Bir ilanı ya da kabul edilmiş bir teklif sohbetini şikayet et. */
export async function POST(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const limited = checkRateLimit(request, "report", { limit: 15, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason || "");
    const note = String(body.note || "").trim().slice(0, 500);
    const offerId = body.offerId ? String(body.offerId) : "";

    if (!REPORT_REASONS.includes(reason as (typeof REPORT_REASONS)[number])) {
      return NextResponse.json({ error: "Geçersiz şikayet nedeni." }, { status: 400 });
    }

    await connectDB();

    if (offerId) {
      // SOHBET ŞİKAYETİ
      if (!Types.ObjectId.isValid(offerId)) {
        return NextResponse.json({ error: "Geçersiz sohbet." }, { status: 400 });
      }
      const offer = await Offer.findById(offerId).lean<OfferLean | null>();
      if (!offer) return NextResponse.json({ error: "Sohbet bulunamadı." }, { status: 404 });

      const isBuyer = offer.buyer.toString() === authUser.userId;
      const isSeller = offer.seller.toString() === authUser.userId;
      if (!isBuyer && !isSeller) {
        return NextResponse.json({ error: "Bu sohbetin tarafı değilsin." }, { status: 403 });
      }
      const reportedUserId = isBuyer ? offer.seller : offer.buyer;

      const [reporter, reported, car] = await Promise.all([
        User.findById(authUser.userId).select("name").lean<{ name: string } | null>(),
        User.findById(reportedUserId).select("name").lean<{ name: string } | null>(),
        Car.findById(offer.car).select("title").lean<{ title: string } | null>(),
      ]);
      const buyerName = isBuyer ? reporter?.name || "Alıcı" : reported?.name || "Alıcı";
      const sellerName = isSeller ? reporter?.name || "Satıcı" : reported?.name || "Satıcı";

      try {
        await Report.create({
          car: offer.car,
          offer: offer._id,
          reportedUser: reportedUserId,
          reporter: authUser.userId,
          reason,
          note,
          chatSnapshot: buildChatSnapshot(offer, buyerName, sellerName),
        });
      } catch (error) {
        if (error instanceof Error && "code" in error && (error as { code?: number }).code === 11000) {
          return NextResponse.json({ error: "Bu sohbeti zaten bildirdin, teşekkürler." }, { status: 409 });
        }
        throw error;
      }

      const admins = await User.find({ role: "admin" }).select("_id").lean<{ _id: Types.ObjectId }[]>();
      await Promise.all(
        admins.map((admin) =>
          createNotification({
            userId: admin._id.toString(),
            type: "report",
            title: `Sohbet şikayeti: ${car?.title || "İlan"}`,
            body: `Neden: ${reason}${note ? ` — ${note}` : ""}`,
            link: "/admin",
          })
        )
      );

      return NextResponse.json({ success: true });
    }

    // İLAN ŞİKAYETİ
    const carId = String(body.carId || "");
    if (!Types.ObjectId.isValid(carId)) {
      return NextResponse.json({ error: "Geçersiz ilan." }, { status: 400 });
    }

    const car = await Car.findById(carId).select("title").lean<{ title: string } | null>();
    if (!car) return NextResponse.json({ error: "İlan bulunamadı." }, { status: 404 });

    try {
      await Report.create({ car: carId, reporter: authUser.userId, reason, note });
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as { code?: number }).code === 11000) {
        return NextResponse.json({ error: "Bu ilanı zaten bildirdin, teşekkürler." }, { status: 409 });
      }
      throw error;
    }

    const admins = await User.find({ role: "admin" }).select("_id").lean<{ _id: Types.ObjectId }[]>();
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin._id.toString(),
          type: "report",
          title: `İlan şikayeti: ${car.title}`,
          body: `Neden: ${reason}${note ? ` — ${note}` : ""}`,
          link: "/admin",
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/reports error:", error);
    return NextResponse.json({ error: "Şikayet gönderilemedi." }, { status: 500 });
  }
}
