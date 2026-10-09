import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { runProbes, summarize } from "@/lib/feature-probes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Yönetim paneli "Site özellikleri" kutusu. Süresi dolmayan kontroller son sonucunu verir (ağır ve yapay zekâ kontrolleri her sorguda
 * çalışmaz); `?force=1` hepsini hemen yeniden dener.
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Bu panel yalnızca yöneticiler içindir." }, { status: 401 });
    await connectDB();
    const force = new URL(request.url).searchParams.get("force") === "1";
    const results = await runProbes({ force });
    return NextResponse.json({ results, summary: summarize(results), checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("feature-status API hatası:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Durum alınamadı" }, { status: 500 });
  }
}
