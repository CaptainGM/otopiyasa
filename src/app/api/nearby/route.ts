import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";
import { findNearbyListings } from "@/lib/nearby";

export const dynamic = "force-dynamic";

/**
 * Konuma en yakın ilanlar. İlanlarda gerçek koordinat genelde yok (kaynak siteler yalnızca
 * şehir/ilçe metni verir); mesafe haritadaki ilçe/il merkezinden hesaplanır ve yaklaşıktır.
 */
export async function GET(request: Request) {
  try {
    const limited = await checkSharedRateLimit(request, "nearby", { limit: 30, windowMs: 10 * 60 * 1000 });
    if (limited) return limited;

    const url = new URL(request.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    const requestedLimit = Number(url.searchParams.get("limit")) || 12;
    const limit = Math.max(1, Math.min(30, Math.trunc(requestedLimit)));

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "lat/lng zorunludur." }, { status: 400 });
    }

    await connectDB();
    const items = await findNearbyListings({ lat, lng }, limit);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/nearby error:", error);
    return NextResponse.json({ error: "Yakındaki ilanlar alınamadı." }, { status: 500 });
  }
}
