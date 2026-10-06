export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { findCarsPage, parseCarFilters } from "@/lib/car-query";
import { attachMarketToCars, isLeanCarDoc } from "@/lib/serialize-car";
import { serializeCarListItem } from "@/lib/serialize-car-list-item";
import { isCacheableFeedSeed, isValidFeedSlot } from "@/lib/car-mix";

export async function GET(request: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const filters = parseCarFilters(searchParams);
    const { docs: rawItems, total, page, limit } = await findCarsPage(filters);
    const docs = rawItems.filter(isLeanCarDoc);
    const compact = searchParams.get("compact") === "1";
    // Kartlardaki piyasa göstergesi ilanın üstündeki saatlik anlık görüntüyü okur (bkz. lib/market-snapshot.ts):
    // her sayfada ayrıca piyasa hesabı yapılmaz. İlan sayfası ve karşılaştırma anlık hesaplar.
    const items = compact
      ? docs.map((car) => serializeCarListItem(car))
      : attachMarketToCars(docs, new Map());

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
          // Eski küçük ortak tohumlar CDN'de paylaşılır; kişiye özel rastgele akış yanıtları saklanmaz.
          // Keşfet dilimleri herkes için aynı (sıra istemcide karıştırılır) → 15 dk CDN'de.
          "Cache-Control": isValidFeedSlot(filters.slot)
            ? "public, s-maxage=900, stale-while-revalidate=300"
            : isCacheableFeedSeed(filters.seed)
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
