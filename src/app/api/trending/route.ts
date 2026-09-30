export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { attachMarketToCars, isLeanCarDoc } from "@/lib/serialize-car";
import { pickTrending } from "@/lib/trending";
import { cached, CACHE_TTL } from "@/lib/cache";

export async function GET() {
  try {
    await connectDB();
    const items = await cached("home:trending", CACHE_TTL.medium, async () => {
      const docs = ((await Car.find({ ...PUBLIC_LISTING_FILTER, viewCount: { $gt: 0 } })
        .sort({ viewCount: -1 })
        .limit(100)
        .slice("images", 2)
        .lean()) as unknown[]).filter(isLeanCarDoc);

      // Trending kartları piyasa karşılaştırma alanlarını göstermiyor; ikinci
      // bir toplu piyasa sorgusu mobil yüklemelerde gereksiz gecikme yaratır.
      const cars = attachMarketToCars(docs, new Map());
      return pickTrending(cars, 30);
    });

    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/trending error:", error);
    return NextResponse.json({ items: [] });
  }
}
