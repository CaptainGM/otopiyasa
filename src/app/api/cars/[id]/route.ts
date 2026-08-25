import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { getMarketMap, segmentKey } from "@/lib/market-price";
import { isLeanCarDoc, serializeCar } from "@/lib/serialize-car";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";
import { buildPriceBins } from "@/lib/price-bins";
import { detectPriceAnomaly } from "@/lib/anomaly";

/** Fiyat dağılımı için segment fiyatları: önce marka+model, az ise yalnız marka (web detay sayfasıyla aynı mantık). */
async function loadSegmentPrices(brand: string, model: string): Promise<{ label: string; prices: number[] }> {
  const mm = (await Car.find({ brand, model }, { price: 1 }).lean()).map((doc) => doc.price as number);
  if (mm.length >= 5) return { label: `${brand} ${model}`, prices: mm };
  const b = (await Car.find({ brand }, { price: 1 }).lean()).map((doc) => doc.price as number);
  return { label: brand, prices: b };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await context.params;
    // Geçersiz ObjectId mongoose'da CastError fırlatır → 500 yerine düzgün 404.
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Araç bulunamadı." }, { status: 404 });
    }
    const carDoc = await Car.findById(id).lean();

    if (!isLeanCarDoc(carDoc)) {
      return NextResponse.json({ error: "Araç bulunamadı." }, { status: 404 });
    }

    /**
     * Moderasyondan geçmemiş üye ilanı herkese açık DEĞİL.
     *
     * Detay SAYFASI bu kontrolü yapıyordu (app/cars/[id]/page.tsx) ama bu API
     * yapmıyordu; yani kimliği bilen/deneyen biri bekleyen ya da REDDEDİLMİŞ bir
     * ilanı — `contactPhone` (kişisel telefon) ve `rejectionReason` dahil —
     * doğrudan uç noktadan okuyabiliyordu. Kural artık iki yerde de aynı.
     */
    const status = (carDoc as { moderationStatus?: string }).moderationStatus;
    if (status === "pending" || status === "rejected") {
      const viewer = await getCurrentUser();
      const ownerId = (carDoc as { ownerId?: { toString(): string } }).ownerId;
      const isOwner = !!viewer && !!ownerId && ownerId.toString() === viewer.userId;
      if (!isOwner && viewer?.role !== "admin") {
        return NextResponse.json({ error: "Araç bulunamadı." }, { status: 404 });
      }
    }

    const [marketMap, favoriteCount, segment] = await Promise.all([
      getMarketMap([{ brand: carDoc.brand, model: carDoc.model, year: carDoc.year }]),
      User.countDocuments({ favorites: carDoc._id }),
      loadSegmentPrices(carDoc.brand, carDoc.model),
    ]);
    const market = marketMap.get(
      segmentKey(carDoc.brand, carDoc.model, carDoc.year)
    );
    const car = serializeCar(carDoc, market);

    return NextResponse.json({
      ...car,
      favoriteCount,
      priceBins: buildPriceBins(segment.prices, car.price),
      segmentLabel: segment.label,
      anomaly: detectPriceAnomaly(car.price, segment.prices),
    });
  } catch (error) {
    console.error("GET /api/cars/[id] error:", error);
    return NextResponse.json(
      { error: "Araç detayı yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
    }

    await connectDB();
    const { id } = await context.params;
    const deleted = await Car.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Araç bulunamadı." }, { status: 404 });
    }

    await logAudit({ action: "car_deleted", actor: admin.name, targetLabel: deleted.title });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/cars/[id] error:", error);
    return NextResponse.json(
      { error: "Araç silinirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
