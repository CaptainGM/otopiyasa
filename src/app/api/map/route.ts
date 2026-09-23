import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { buildClusters, buildMapQuery, type ClusterInput } from "@/lib/map-clusters";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { cached, CACHE_TTL } from "@/lib/cache";
import { isNonCarBrand, normalizeBrand } from "@/lib/normalize-brand";
import { normalizeCity } from "@/lib/normalize-city";

export const dynamic = "force-dynamic";

/**
 * Harita kümeleri + filtre seçenekleri.
 *
 * İstemciye 5511 ilan yerine birkaç yüz KÜME gönderir (koordinat + adet + en
 * düşük fiyat). İlanların kendisi yalnızca bir kümeye tıklanınca
 * `/api/map/cars` ile çekilir.
 */
export async function GET(request: Request) {
  try {
    await connectDB();
    const params = new URL(request.url).searchParams;
    const query = buildMapQuery(params);

    const hasFilter = params.toString().length > 0;

    const [mapData, options] = await Promise.all([
      hasFilter
        ? (async () => {
            const cars = (await Car.find(query, { _id: 0, city: 1, address: 1, price: 1 })
              .limit(5000)
              .lean()) as unknown as ClusterInput[];
            return buildClusters(cars);
          })()
        : cached("map:default_clusters", CACHE_TTL.long, async () => {
            const cars = (await Car.find(PUBLIC_LISTING_FILTER, { _id: 0, city: 1, address: 1, price: 1 })
              .lean()) as unknown as ClusterInput[];
            return buildClusters(cars);
          }),

      cached("map:options", CACHE_TTL.long, async () => {
        const [brands, cities, fuels] = await Promise.all([
          Car.distinct("brand", PUBLIC_LISTING_FILTER),
          Car.distinct("city", PUBLIC_LISTING_FILTER),
          Car.distinct("features.fuelType", PUBLIC_LISTING_FILTER),
        ]);

        const sortTr = (list: unknown[]) =>
          (list as string[])
            .filter((v) => v && v !== "Bilinmiyor" && v !== "Türkiye")
            .sort((a, b) => a.localeCompare(b, "tr"));

        return {
          brands: [...new Set((brands as string[]).filter((brand) => !isNonCarBrand(brand)).map(normalizeBrand))]
            .sort((a, b) => a.localeCompare(b, "tr")),
          cities: [...new Set((cities as string[]).filter((city) => city && city !== "Türkiye").map(normalizeCity))]
            .sort((a, b) => a.localeCompare(b, "tr")),
          fuels: sortTr(fuels),
        };
      }),
    ]);

    return NextResponse.json({
      clusters: mapData.clusters,
      total: mapData.total,
      unmapped: mapData.unmapped,
      options,
    });
  } catch (error) {
    console.error("GET /api/map error:", error);
    return NextResponse.json({ error: "Harita verisi alınamadı." }, { status: 500 });
  }
}
