export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { findCarsPage, parseCarFilters } from "@/lib/car-query";
import { getMarketMap } from "@/lib/market-price";
import { attachMarketToCars, isLeanCarDoc } from "@/lib/serialize-car";
import { serializeCarListItem } from "@/lib/serialize-car-list-item";
import { isCacheableFeedSeed } from "@/lib/car-mix";

export async function GET(request: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const filters = parseCarFilters(searchParams);
    const { docs: rawItems, total, page, limit } = await findCarsPage(filters);
    const docs = rawItems.filter(isLeanCarDoc);
    const compact = searchParams.get("compact") === "1";
    // Listing rows never show market aggregates. Skipping the aggregation for
    // compact requests avoids a second database query on every infinite-scroll
    // page and on the mobile home list; detail/compare API responses stay full.
    const items = compact
      ? docs.map((car) => serializeCarListItem(car))
      : attachMarketToCars(
          docs,
          await getMarketMap(
            docs.map((car) => ({
              brand: car.brand,
              model: car.model,
              year: car.year,
            }))
          )
        );

    const isDefaultQuery =
      !searchParams.toString() ||
      searchParams.toString() === "page=1" ||
      searchParams.toString() === "sort=newest";

    return NextResponse.json(
      {
        items,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
      },
      {
        headers: {
          // Yanıt kullanıcıya göre değişmez; tohum havuzdaysa (ya da yoksa) 5 dk CDN'de saklanır.
          "Cache-Control": isCacheableFeedSeed(filters.seed)
            ? "public, s-maxage=300, stale-while-revalidate=900"
            : "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/cars error:", error);
    return NextResponse.json(
      { error: "Araçlar yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
