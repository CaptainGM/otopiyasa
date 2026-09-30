import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { sweepAndCleanDeadListings } from "@/lib/scraper/verify-listing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 50, 250);
    const source = body.source || "all";

    await connectDB();

    const result = await sweepAndCleanDeadListings({
      limit,
      source,
      concurrency: 4,
      // Sunucusuz fonksiyonun süre sınırına takılmadan cevap dönebilsin.
      maxDurationMs: 45_000,
    });

    const breakerNote = result.breaker.length > 0 ? ` Güvenlik freni: ${result.breaker.join("; ")}.` : "";
    return NextResponse.json({
      success: true,
      ...result,
      message:
        `${result.checked} ilan kontrol edildi: ${result.archived} kaldırılmış ilan arşive taşındı, ` +
        `${result.active} canlı doğrulandı, ${result.errors} belirsiz (dokunulmadı).${breakerNote}`,
    });
  } catch (error: any) {
    console.error("Bulk clean API error:", error);
    return NextResponse.json(
      { error: error?.message || "Süpürme işlemi sırasında hata oluştu" },
      { status: 500 }
    );
  }
}
