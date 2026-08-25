import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { resolvePlacement } from "@/lib/district-coords";
import { distanceKm } from "@/lib/map-clusters";
import { LIST_IMAGE_LIMIT } from "@/lib/serialize-car";
import { checkRateLimit } from "@/lib/api-rate-limit";

export const dynamic = "force-dynamic";

interface NearbyCandidate {
  _id: unknown;
  title: string;
  year: number;
  city: string;
  address?: string;
  description?: string;
  price: number;
  imageUrl: string;
  images?: string[];
}

/**
 * Tarayıcı konumuna en yakın ilanlar. Konum verisi ilanlarda GENELDE yok
 * (kaynak siteler yalnızca şehir/ilçe metni verir) — bu yüzden aynı
 * yaklaşık-konum mantığı haritada da kullanılan `resolvePlacement`ten
 * geliyor (dürüst: gerçek koordinat değilse ilçe/il merkezi, uydurma değil).
 */
export async function GET(request: Request) {
  try {
    const limited = checkRateLimit(request, "nearby", { limit: 30, windowMs: 10 * 60 * 1000 });
    if (limited) return limited;

    const url = new URL(request.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    const limit = Math.min(20, Number(url.searchParams.get("limit")) || 12);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "lat/lng zorunludur." }, { status: 400 });
    }

    await connectDB();

    // Haritayla aynı desen: kümeleme/mesafe için yalnızca gereken alanlar,
    // description sadece adresi olmayan ilanlarda çekiliyor (yük azaltmak için).
    const candidates = (await Car.aggregate([
      { $match: PUBLIC_LISTING_FILTER },
      {
        $project: {
          title: 1,
          year: 1,
          city: 1,
          address: 1,
          price: 1,
          imageUrl: 1,
          images: { $slice: ["$images", LIST_IMAGE_LIMIT] },
          description: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ["$address", ""] } }, 0] },
              "$$REMOVE",
              { $ifNull: ["$description", ""] },
            ],
          },
        },
      },
    ])) as unknown as NearbyCandidate[];

    const withDistance = candidates
      .map((car) => {
        const placed = resolvePlacement(car.city || "", car.address, 0, car.description);
        if (!placed) return null;
        return {
          _id: String(car._id),
          title: car.title,
          year: car.year,
          city: car.city,
          price: car.price,
          imageUrl: car.imageUrl,
          images: car.images || [],
          distanceKm: Math.round(distanceKm({ lat, lng }, placed) * 10) / 10,
          approximate: placed.level === "province",
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return NextResponse.json({ items: withDistance });
  } catch (error) {
    console.error("GET /api/nearby error:", error);
    return NextResponse.json({ error: "Yakındaki ilanlar alınamadı." }, { status: 500 });
  }
}
