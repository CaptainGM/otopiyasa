import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { getMarketMap } from "@/lib/market-price";
import { attachMarketToCars, isLeanCarDoc, LIST_IMAGE_LIMIT } from "@/lib/serialize-car";
import { pickDeals, DEAL_MIN_YEAR, DEAL_MAX_MILEAGE } from "@/lib/deals";

export const dynamic = "force-dynamic";

/** "Haftanın fırsatları" — web'in DealsStrip'i ile aynı hesap, mobil için JSON. */
export async function GET() {
  try {
    await connectDB();
    const docs = ((await Car.find({
      ...PUBLIC_LISTING_FILTER,
      year: { $gte: DEAL_MIN_YEAR },
      mileage: { $lte: DEAL_MAX_MILEAGE },
      damageFlag: { $ne: true },
    })
      .sort({ updatedAt: -1 })
      .limit(400)
      .slice("images", LIST_IMAGE_LIMIT)
      .lean()) as unknown[]).filter(isLeanCarDoc);

    const marketMap = await getMarketMap(
      docs.map((car) => ({ brand: car.brand, model: car.model, year: car.year }))
    );
    const cars = attachMarketToCars(docs, marketMap);
    const deals = pickDeals(cars, 8);

    return NextResponse.json({ items: deals });
  } catch (error) {
    console.error("GET /api/deals error:", error);
    return NextResponse.json({ error: "Fırsatlar alınamadı." }, { status: 500 });
  }
}
