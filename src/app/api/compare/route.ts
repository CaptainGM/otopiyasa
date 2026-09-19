import { NextResponse } from "next/server";
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

    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length < 2) {
      return NextResponse.json({ error: "At least two ids required to compare" }, { status: 400 });
    }

    // GÜVENLİK: Yalnızca aktif ve onaylı ilanları karşılaştırma için döndür.
    const cars = await Car.find({ _id: { $in: ids }, ...PUBLIC_LISTING_FILTER }).lean();
    const docs = (cars as unknown[]).filter(isLeanCarDoc);

    const marketMap = await getMarketMap(docs.map((c) => ({ brand: c.brand, model: c.model, year: c.year })));
    const serialized = docs.map((d) =>
      serializeCarPublic(d, marketMap.get(segmentKey(d.brand, d.model, d.year)))
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
