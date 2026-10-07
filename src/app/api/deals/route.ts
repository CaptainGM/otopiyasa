import { NextResponse } from "next/server";
import { getDealStrip } from "@/lib/deal-strip";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * "Haftanın fırsatları" (mobil şerit): web ana sayfasıyla aynı 12 fırsat ve toplam fırsat sayısı. Tamamı
 * /api/cars?firsat=1 ile sayfa sayfa alınır.
 */
export async function GET() {
  try {
    const { items, total } = await getDealStrip();
    return NextResponse.json(
      { items, total },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } }
    );
  } catch (error) {
    console.error("GET /api/deals error:", error);
    return NextResponse.json({ error: "Fırsatlar alınamadı." }, { status: 500 });
  }
}
