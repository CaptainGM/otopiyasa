import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Subscription } from "@/models/Subscription";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";

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

    const limited = checkRateLimit(request, "subscription-create", { limit: 20, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = await request.json();
    const { email, brand, model, yearMin, yearMax, maxPrice, targetAvgPrice } = body;
    if (!email) return NextResponse.json({ error: "E-posta zorunludur." }, { status: 400 });
    if (targetAvgPrice && !brand) {
      return NextResponse.json(
        { error: "Ortalama fiyat alarmı için marka seçmelisin." },
        { status: 400 }
      );
    }

    await connectDB();
    const created = await Subscription.create({
      user: auth.userId,
      email,
      brand: brand || null,
      model: model || null,
      yearMin: yearMin || null,
      yearMax: yearMax || null,
      maxPrice: maxPrice || null,
      targetAvgPrice: targetAvgPrice || null,
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

    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id zorunludur." }, { status: 400 });

    await connectDB();
    await Subscription.deleteOne({ _id: id, user: auth.userId });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Abonelik silinemedi." }, { status: 500 });
  }
}
