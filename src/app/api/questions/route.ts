import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { Question } from "@/models/Question";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { appBaseUrl } from "@/lib/app-url";
import { createNotification } from "@/lib/notify";
import { maskName } from "@/lib/form-options";
import { isMailerConfigured, sendNewQuestionEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

/** Bir ilanın soruları — herkese açık (cevaplananlar tekrar sorulmasın diye). */
export async function GET(request: Request) {
  const carId = new URL(request.url).searchParams.get("carId") || "";
  if (!Types.ObjectId.isValid(carId)) {
    return NextResponse.json({ error: "Geçersiz ilan." }, { status: 400 });
  }

  await connectDB();
  const rows = await Question.find({ car: carId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate({ path: "asker", model: User, select: "name" })
    .lean<
      {
        _id: Types.ObjectId;
        text: string;
        answer: string;
        answeredAt: Date | null;
        createdAt: Date;
        asker?: { name?: string };
      }[]
    >();

  return NextResponse.json({
    items: rows.map((q) => ({
      id: q._id.toString(),
      text: q.text,
      answer: q.answer || "",
      answered: !!q.answer,
      askerName: maskName(q.asker?.name || ""),
      createdAt: q.createdAt?.toISOString?.() || "",
      answeredAt: q.answeredAt ? q.answeredAt.toISOString() : "",
    })),
  });
}

/** İlana soru sor (yalnızca üye ilanları; kendi ilanına sorulmaz). */
export async function POST(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const limited = checkRateLimit(request, "question", { limit: 20, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const carId = String(body.carId || "");
    const text = String(body.text || "").trim().slice(0, 1000);

    if (!Types.ObjectId.isValid(carId)) {
      return NextResponse.json({ error: "Geçersiz ilan." }, { status: 400 });
    }
    if (!text) return NextResponse.json({ error: "Soru boş olamaz." }, { status: 400 });

    await connectDB();
    const car = await Car.findById(carId).select("title ownerId sourceSite moderationStatus status").lean<{
      _id: Types.ObjectId; title: string; ownerId?: Types.ObjectId;
      sourceSite?: string; moderationStatus?: string; status?: string;
    }>();

    if (!car) return NextResponse.json({ error: "İlan bulunamadı." }, { status: 404 });
    if (car.sourceSite !== "user" || !car.ownerId) {
      return NextResponse.json(
        { error: "Bu ilan bir referans kaydı; soru yalnızca üye ilanlarına sorulabilir." },
        { status: 400 }
      );
    }
    if (car.moderationStatus === "pending" || car.moderationStatus === "rejected") {
      return NextResponse.json({ error: "Bu ilan şu anda yayında değil." }, { status: 400 });
    }
    if (car.status && car.status !== "active") {
      return NextResponse.json({ error: "Bu ilan artık aktif değil, soru sorulamaz." }, { status: 400 });
    }
    if (car.ownerId.toString() === authUser.userId) {
      return NextResponse.json({ error: "Kendi ilanına soru soramazsın." }, { status: 400 });
    }

    const created = await Question.create({
      car: carId,
      asker: authUser.userId,
      seller: car.ownerId,
      text,
    });

    const link = `/cars/${carId}`;
    await createNotification({
      userId: car.ownerId.toString(),
      type: "question",
      title: `İlanına yeni soru: ${car.title}`,
      body: `${authUser.name}: ${text.slice(0, 120)}`,
      link,
    });

    if (isMailerConfigured()) {
      const seller = await User.findById(car.ownerId).select("email").lean<{ email: string }>();
      if (seller?.email) {
        sendNewQuestionEmail(seller.email, {
          carTitle: car.title,
          askerName: authUser.name,
          text,
          url: `${appBaseUrl()}${link}`,
        }).catch((e) => console.warn("sendNewQuestionEmail failed:", e));
      }
    }

    return NextResponse.json({ id: created._id.toString() });
  } catch (error) {
    console.error("POST /api/questions error:", error);
    return NextResponse.json({ error: "Soru gönderilemedi." }, { status: 500 });
  }
}
