import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { findGlobalDeals } from "@/lib/deals";
import { cached, CACHE_TTL } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** "Haftanın fırsatları" — 30.000+ ilanlık tüm veritabanını tarayarak en avantajlı 30 gerçek fırsatı döner. */
export async function GET() {
  try {
    await connectDB();
    const deals = await cached("home:deals:global", CACHE_TTL.long, async () => {
      return findGlobalDeals(30);
    });

    return NextResponse.json(
      { items: deals },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/deals error:", error);
    return NextResponse.json({ error: "Fırsatlar alınamadı." }, { status: 500 });
  }
}
