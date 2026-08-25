import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";

export const dynamic = "force-dynamic";

/**
 * Satıcının kendi ilanını "satıldı" işaretlemesi / tekrar yayına alması.
 *
 * Bilinçli olarak SİLME değil — ilan (ve geçmişteki teklif/soru kayıtları)
 * saklanır, yalnızca kamuya açık listelerden düşer (bkz. lib/listing-visibility.ts).
 * "removed" durumu buradan AYARLANAMAZ — o yalnızca kaynak sitede artık
 * bulunamayan (satılmış/kaldırılmış) derlenmiş ilanlar için scraper tarafından
 * kullanılır (bkz. lib/scraper/run-scrape.ts runPriceRefresh).
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

    const limited = checkRateLimit(request, "listing-status", { limit: 40, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "İlan bulunamadı." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const status = body.status === "sold" ? "sold" : body.status === "active" ? "active" : null;
    if (!status) {
      return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
    }

    await connectDB();
    const car = await Car.findById(id);
    if (!car || !car.ownerId || car.ownerId.toString() !== authUser.userId) {
      return NextResponse.json({ error: "İlan bulunamadı veya yetkiniz yok." }, { status: 404 });
    }

    car.status = status;
    await car.save();

    return NextResponse.json({ status: car.status });
  } catch (error) {
    console.error("PATCH /api/listings/[id]/status error:", error);
    return NextResponse.json({ error: "Durum güncellenemedi." }, { status: 500 });
  }
}
