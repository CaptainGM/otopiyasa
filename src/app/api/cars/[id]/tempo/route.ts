import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { getMarketTempo } from "@/lib/market-tempo";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";

/**
 * İlanın piyasa temposu: benzer ilanlar kaç günde yayından kalkıyor, satıcılar yayındayken ne kadar indiriyor
 * (bkz. lib/market-tempo.ts). Hesap ilk istekte birkaç saniye sürebildiği için ilan sayfasından ayrı yüklenir;
 * sonuç segment başına 6 saat önbellekte ve CDN'de tutulur. Yetersiz veride `tempo: null`.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ tempo: null }, { status: 404 });
    await connectDB();
    const car = await Car.findOne({ _id: id, ...PUBLIC_LISTING_FILTER })
      .select("brand model year vehicleClass")
      .lean<{ brand: string; model: string; year: number; vehicleClass?: string } | null>();
    if (!car) return NextResponse.json({ tempo: null }, { status: 404 });
    return NextResponse.json(
      { tempo: await getMarketTempo(car) },
      { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=21600" } }
    );
  } catch (error) {
    console.error("GET /api/cars/[id]/tempo error:", error);
    return NextResponse.json({ tempo: null });
  }
}
