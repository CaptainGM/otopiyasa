import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { collectHealthSnapshot, evaluateHealth } from "@/lib/health-check";

export const dynamic = "force-dynamic";

/** Anlık sistem sağlığı (mobil yönetim ekranı). Yalnızca okur; bildirimleri saatlik denetim gönderir. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  try {
    await connectDB();
    const checkedAt = new Date();
    const issues = evaluateHealth(await collectHealthSnapshot(checkedAt));
    return NextResponse.json({ issues, checkedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/admin/health error:", error);
    return NextResponse.json({ error: "Sağlık durumu alınamadı." }, { status: 500 });
  }
}
