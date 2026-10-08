import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { loadDailySummary } from "@/lib/daily-summary-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Bu panel yalnızca yöneticiler içindir." }, { status: 401 });
    }
    await connectDB();
    const summary = await loadDailySummary();
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("daily-summary API hatası:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Günlük özet alınamadı" }, { status: 500 });
  }
}
