import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { readJson } from "@/lib/http";
import { connectDB } from "@/lib/mongodb";
import { Subscription } from "@/models/Subscription";
import { User } from "@/models/User";
import { getCurrentUser } from "@/lib/auth";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";

/** Bir hesabın tutabileceği en fazla kayıtlı arama; her biri her taramada sorgu ve e-posta demek. */
const MAX_SUBSCRIPTIONS = 20;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const amount = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return v !== null && v !== "" && Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
};

export async function GET() {
  try {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ subscriptions: [] });

    await connectDB();
    const rows = await Subscription.find({ user: auth.userId }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ subscriptions: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Abonelikler yüklenemedi." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const limited = await checkSharedRateLimit(request, "subscription-create", { limit: 20, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = await readJson(request, { flat: true });
    const brand = text(body.brand, 40);
    const model = text(body.model, 60);
    const yearMin = amount(body.yearMin, 1950, 2100);
    const yearMax = amount(body.yearMax, 1950, 2100);
    const maxPrice = amount(body.maxPrice, 1, 1_000_000_000);
    const targetAvgPrice = amount(body.targetAvgPrice, 1, 1_000_000_000);
    if (targetAvgPrice && !brand) {
      return NextResponse.json(
        { error: "Ortalama fiyat alarmı için marka seçmelisin." },
        { status: 400 }
      );
    }

    await connectDB();
    // Uyarı hesabın kendi (doğrulanmış) adresine gider. Eskiden gövdedeki e-posta olduğu gibi
    // kaydediliyordu; herkes başka birinin adresine bizim sunucumuzdan e-posta attırabiliyordu.
    const user = await User.findById(auth.userId).select("email").lean<{ email?: string }>();
    if (!user?.email) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

    const count = await Subscription.countDocuments({ user: auth.userId });
    if (count >= MAX_SUBSCRIPTIONS) {
      return NextResponse.json(
        { error: `En fazla ${MAX_SUBSCRIPTIONS} kayıtlı arama tutabilirsin. Önce birini sil.` },
        { status: 400 }
      );
    }

    const created = await Subscription.create({
      user: auth.userId,
      email: user.email,
      brand: brand || null,
      model: model || null,
      yearMin,
      yearMax,
      maxPrice,
      targetAvgPrice,
    });

    return NextResponse.json({ subscription: created });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Abonelik oluşturulamadı." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const { id } = await readJson(request, { flat: true });
    if (typeof id !== "string" || !Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "id zorunludur." }, { status: 400 });
    }

    await connectDB();
    await Subscription.deleteOne({ _id: id, user: auth.userId });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Abonelik silinemedi." }, { status: 500 });
  }
}
