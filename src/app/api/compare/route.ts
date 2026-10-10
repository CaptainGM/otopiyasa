import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { getMarketMap, segmentKey } from "@/lib/market-price";
import { isLeanCarDoc, serializeCarPublic } from "@/lib/serialize-car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";

export async function GET(request: Request) {
  try {
    await connectDB();
    const url = new URL(request.url);
    const idsParam = url.searchParams.get("ids");
    if (!idsParam) {
      return NextResponse.json({ error: "ids query param required (comma separated)" }, { status: 400 });
    }

    // Geçersiz kimlik Mongo CastError (500) yerine yok sayılır; en fazla 6 ilan karşılaştırılır.
    const ids = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => Types.ObjectId.isValid(s))
      .slice(0, 6);
    if (ids.length < 2) {
      return NextResponse.json({ error: "At least two ids required to compare" }, { status: 400 });
    }

    // GÜVENLİK: Yalnızca aktif ve onaylı ilanları karşılaştırma için döndür.
    const cars = await Car.find({ _id: { $in: ids }, ...PUBLIC_LISTING_FILTER }).lean();
    const docs = (cars as unknown[]).filter(isLeanCarDoc);

    const excludedListingIds = docs.map((car) => new Types.ObjectId(car._id.toString()));
    const marketMap = await getMarketMap(
      docs.map((c) => ({ brand: c.brand, model: c.model, year: c.year, vehicleClass: c.vehicleClass })),
      excludedListingIds
    );
    const serialized = docs.map((d) =>
      serializeCarPublic(d, marketMap.get(segmentKey(d.brand, d.model, d.year, d.vehicleClass)))
    );

    // Sonuçları kullanıcının verdiği ID sırasına göre diz (sütun sırası sabit kalsın)
    const items = ids
      .map((id) => serialized.find((c) => c._id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/compare error:", error);
    return NextResponse.json({ error: "Karşılaştırma yapılamadı." }, { status: 500 });
  }
}
