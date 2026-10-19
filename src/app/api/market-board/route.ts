import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getMarketBoard } from "@/lib/market-board";

export const dynamic = "force-dynamic";

/**
 * Mobil uygulamanın ana ekranındaki üst panoyu web ana sayfasıyla aynı veriyle doldurması için (bkz. src/app/page.tsx
 * piyasa panosu). getMarketBoard() zaten sunucu belleğinde 15 dk önbellekli; burada CDN'de de kısa süre tutulur ki
 * mobil her açılışta sunucuyu tekrar yormasın (az hücresel veri hedefi).
 */
export async function GET() {
  try {
    await connectDB();
    const board = await getMarketBoard();
    return NextResponse.json(board, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" },
    });
  } catch (error) {
    console.error("GET /api/market-board error:", error);
    return NextResponse.json({ error: "Piyasa panosu yüklenirken bir hata oluştu." }, { status: 500 });
  }
}
