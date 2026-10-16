import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";
import {
  NEARBY_SORTS,
  NEARBY_VEHICLE_CLASSES,
  findNearbyListings,
  findNearbyPage,
  type NearbySort,
  type NearbyVehicleClass,
} from "@/lib/nearby";

export const dynamic = "force-dynamic";

const DEFAULT_RADIUS_KM = 10;
const MAX_RADIUS_KM = 50;
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 50;

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  // Number(null) = 0; parametre hiç yoksa ya da boşsa varsayılan kullanılmalı.
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/**
 * Konuma en yakın ilanlar. İlanlarda gerçek koordinat genelde yok (kaynak siteler yalnızca
 * şehir/ilçe metni verir); mesafe haritadaki ilçe/il merkezinden hesaplanır ve yaklaşıktır.
 *
 * İki kullanım:
 *  - `limit` (web): en yakın N ilan, yarıçap yok.
 *  - `radiusKm` (mobil): yarıçap içindeki tüm ilanlar, `page` / `pageSize` ile sayfalı;
 *    isteğe bağlı `vehicleClass` ve `sort` (distance | priceAsc | priceDesc).
 */
export async function GET(request: Request) {
  try {
    const limited = await checkSharedRateLimit(request, "nearby", { limit: 120, windowMs: 10 * 60 * 1000 });
    if (limited) return limited;

    const url = new URL(request.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "lat/lng zorunludur." }, { status: 400 });
    }

    await connectDB();

    if (url.searchParams.has("radiusKm")) {
      const vehicleParam = url.searchParams.get("vehicleClass");
      const sortParam = url.searchParams.get("sort") ?? "distance";
      if (vehicleParam && !(NEARBY_VEHICLE_CLASSES as readonly string[]).includes(vehicleParam)) {
        return NextResponse.json({ error: "Geçersiz araç sınıfı." }, { status: 400 });
      }
      if (!(NEARBY_SORTS as readonly string[]).includes(sortParam)) {
        return NextResponse.json({ error: "Geçersiz sıralama." }, { status: 400 });
      }
      const radiusKm = clampInt(url.searchParams.get("radiusKm"), DEFAULT_RADIUS_KM, 1, MAX_RADIUS_KM);
      const page = clampInt(url.searchParams.get("page"), 1, 1, 1000);
      const pageSize = clampInt(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
      const result = await findNearbyPage(
        { lat, lng },
        {
          radiusKm,
          page,
          pageSize,
          sort: sortParam as NearbySort,
          vehicleClass: (vehicleParam ?? undefined) as NearbyVehicleClass | undefined,
        }
      );
      return NextResponse.json({ ...result, page, radiusKm });
    }

    const limit = clampInt(url.searchParams.get("limit"), 12, 1, 30);
    const items = await findNearbyListings({ lat, lng }, limit);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/nearby error:", error);
    return NextResponse.json({ error: "Yakındaki ilanlar alınamadı." }, { status: 500 });
  }
}
