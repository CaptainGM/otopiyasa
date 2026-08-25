import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/app-url";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Comment } from "@/models/Comment";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { User } from "@/models/User";
import { Car } from "@/models/Car";
import { analyzeSentiment, summarizeSentiments } from "@/lib/sentiment";
import { createNotification } from "@/lib/notify";
import { isMailerConfigured, sendNewCommentEmail } from "@/lib/mailer";
import { sendPushToUsers, isPushConfigured } from "@/lib/web-push";

/**
 * İlan bir üye ilanıysa (ownerId var) ve yorumu sahibinden BAŞKASI yaptıysa,
 * ilan sahibine site içi bildirim + e-posta + web-push gönderir. Hepsi bağımsız
 * ve best-effort — biri başarısız olsa diğerleri denenir, yorum akışı bozulmaz.
 */
async function notifyCommentOwner(carId: string, commenterId: string, text: string) {
  const car = await Car.findById(carId).select("title ownerId").lean<{
    title: string; ownerId?: { toString(): string } | null;
  }>();
  if (!car?.ownerId) return;
  const ownerId = car.ownerId.toString();
  if (ownerId === commenterId) return; // kendi ilanına kendi yorumu

  const [commenter, owner] = await Promise.all([
    User.findById(commenterId).select("name").lean<{ name: string }>(),
    User.findById(ownerId).select("email").lean<{ email: string }>(),
  ]);
  const commenterName = commenter?.name || "Bir kullanıcı";
  const link = `/cars/${carId}`;
  const preview = text.slice(0, 200);

  await createNotification({
    userId: ownerId,
    type: "comment",
    title: `İlanına yorum: ${car.title}`,
    body: `${commenterName}: ${preview}`,
    link,
  });

  const appUrl = appBaseUrl();
  if (owner?.email && isMailerConfigured()) {
    sendNewCommentEmail(owner.email, {
      carTitle: car.title,
      commenterName,
      text: preview,
      url: `${appUrl}${link}`,
    }).catch((e) => console.warn("sendNewCommentEmail failed:", e));
  }
  if (isPushConfigured()) {
    sendPushToUsers([ownerId], {
      title: `İlanına yorum: ${car.title}`,
      body: `${commenterName}: ${preview}`,
      url: link,
    }).catch((e) => console.warn("comment push failed:", e));
  }
}

export async function GET(request: Request) {
  try {
    await connectDB();
    const url = new URL(request.url);
    const carId = url.searchParams.get("carId");

    if (!carId) {
      return NextResponse.json({ error: "carId query param is required" }, { status: 400 });
    }

    const rows = await Comment.find({ car: carId })
      .sort({ createdAt: -1 })
      .populate({ path: "user", model: User, select: "name" })
      .lean();

    const commentsWithSentiment = rows.map((row) => ({
      ...row,
      sentiment: analyzeSentiment(row.text).label,
    }));
    const summary = summarizeSentiments(commentsWithSentiment.map((c) => c.sentiment));

    return NextResponse.json({ comments: commentsWithSentiment, sentimentSummary: summary });
  } catch (error) {
    console.error("GET /api/comments error:", error);
    return NextResponse.json({ error: "Yorumlar yüklenirken hata." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    // Yorum akışı hız sınırsızdı — tek hesap sonsuz yorum yazabiliyordu.
    const limited = checkRateLimit(request, "comment", { limit: 15, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = await request.json();
    const { carId, text, rating } = body;

    if (!carId || !text || typeof rating !== "number") {
      return NextResponse.json({ error: "carId, text ve rating zorunludur." }, { status: 400 });
    }

    // Tam sayı şartı: 3.7 yıldız ortalamaları ve arayüzü bozuyordu.
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating 1 ile 5 arasında tam sayı olmalıdır." }, { status: 400 });
    }

    if (!Types.ObjectId.isValid(String(carId))) {
      return NextResponse.json({ error: "Geçersiz ilan kimliği." }, { status: 400 });
    }

    await connectDB();

    const created = await Comment.create({
      car: carId,
      user: authUser.userId,
      text: String(text).slice(0, 2000),
      rating,
    });

    // populate user name
    const populated = await Comment.findById(created._id).populate({ path: "user", model: User, select: "name" }).lean();

    // İlan bir ÜYE ilanıysa ve yorumu başkası yaptıysa sahibine bildir
    // (site içi bildirim + e-posta). Ana yanıtı bloklamadan, best-effort.
    notifyCommentOwner(carId, authUser.userId, String(text)).catch((e) =>
      console.warn("notifyCommentOwner failed:", e)
    );

    return NextResponse.json({ comment: populated });
  } catch (error) {
    console.error("POST /api/comments error:", error);
    return NextResponse.json({ error: "Yorum eklenemedi." }, { status: 500 });
  }
}
