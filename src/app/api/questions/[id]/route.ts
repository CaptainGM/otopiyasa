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
import { isMailerConfigured, sendQuestionAnsweredEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

/** Soruyu yanıtla — yalnızca İLAN SAHİBİ. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const limited = checkRateLimit(request, "answer", { limit: 40, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Soru bulunamadı." }, { status: 404 });
    }

    await connectDB();
    const question = await Question.findById(id);
    if (!question) return NextResponse.json({ error: "Soru bulunamadı." }, { status: 404 });

    // Yetki: yalnızca ilanın sahibi cevaplayabilir.
    if (question.seller.toString() !== authUser.userId) {
      return NextResponse.json({ error: "Bu soruyu yalnızca ilan sahibi yanıtlayabilir." }, { status: 403 });
    }
    if (question.answer) {
      return NextResponse.json({ error: "Bu soru zaten yanıtlanmış." }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const answer = String(body.answer || "").trim().slice(0, 1000);
    if (!answer) return NextResponse.json({ error: "Cevap boş olamaz." }, { status: 400 });

    question.answer = answer;
    question.answeredAt = new Date();
    await question.save();

    const car = await Car.findById(question.car).select("title").lean<{ title: string }>();
    const link = `/cars/${question.car.toString()}`;

    await createNotification({
      userId: question.asker.toString(),
      type: "question",
      title: `Sorun yanıtlandı: ${car?.title || "İlan"}`,
      body: answer.slice(0, 120),
      link,
    });

    if (isMailerConfigured()) {
      const asker = await User.findById(question.asker).select("email").lean<{ email: string }>();
      if (asker?.email) {
        sendQuestionAnsweredEmail(asker.email, {
          carTitle: car?.title || "İlan",
          question: question.text,
          answer,
          url: `${appBaseUrl()}${link}`,
        }).catch((e) => console.warn("sendQuestionAnsweredEmail failed:", e));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/questions/[id] error:", error);
    return NextResponse.json({ error: "Cevap kaydedilemedi." }, { status: 500 });
  }
}
