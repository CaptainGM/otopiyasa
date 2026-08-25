import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { buildClusters, buildMapQuery, type ClusterInput } from "@/lib/map-clusters";

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

    // Yalnızca kümeleme için gereken alanlar — yükün büyük kısmı buradan düşüyor.
    // `description` SADECE adresi olmayan ilanlar için getirilir (konum oradan
    // çıkarılacak); adresi olanlarda gereksiz yere on binlerce satır metin
    // taşımamak için $$REMOVE ile atılır.
    const cars = (await Car.aggregate([
      { $match: query },
      {
        $project: {
          _id: 0,
          city: 1,
          address: 1,
          price: 1,
          description: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ["$address", ""] } }, 0] },
              "$$REMOVE",
              { $ifNull: ["$description", ""] },
            ],
          },
        },
      },
    ])) as unknown as ClusterInput[];

    const { clusters, total, unmapped } = buildClusters(cars);

    // Filtre açılır listeleri (kaynak YOK — kullanıcıyı ilgilendirmiyor)
    const [brands, cities, fuels] = await Promise.all([
      Car.distinct("brand"),
      Car.distinct("city"),
      Car.distinct("features.fuelType"),
    ]);

    const sortTr = (list: unknown[]) =>
      (list as string[])
        .filter((v) => v && v !== "Bilinmiyor" && v !== "Türkiye")
        .sort((a, b) => a.localeCompare(b, "tr"));

    return NextResponse.json({
      clusters,
      total,
      unmapped,
      options: { brands: sortTr(brands), cities: sortTr(cities), fuels: sortTr(fuels) },
    });
  } catch (error) {
    console.error("GET /api/map error:", error);
    return NextResponse.json({ error: "Harita verisi alınamadı." }, { status: 500 });
  }
}
