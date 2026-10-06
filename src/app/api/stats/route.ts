import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { MARKET_LISTING_FILTER as PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { cached, CACHE_TTL } from "@/lib/cache";

export async function GET() {
  try {
    await connectDB();

    const data = await cached("api:stats:v3", CACHE_TTL.long, async () => {
      // Ortalamalar web analiz sayfasıyla aynı süzgeçle: hatalı/trol fiyatlar (1 TL, 999 milyon) ortalamayı bozmasın.
      // Eskiden mobil süzgeçsiz ortalama gösterdiği için web ile mobil farklı "piyasa ortalaması" yazıyordu.
      const publicMatch = { $match: { ...PUBLIC_LISTING_FILTER, price: { $gte: 50_000, $lte: 40_000_000 } } };

      const [byBrand, byYear, totalCars, overall] = await Promise.all([
        Car.aggregate([
          publicMatch,
          {
            $group: {
              _id: "$brand",
              count: { $sum: 1 },
              avgPrice: { $avg: "$price" },
            },
          },
          { $sort: { avgPrice: -1 } },
          {
            $project: {
              _id: 0,
              brand: "$_id",
              count: 1,
              avgPrice: { $round: ["$avgPrice", 0] },
            },
          },
        ]),
        Car.aggregate([
          publicMatch,
          {
            $group: {
              _id: "$year",
              count: { $sum: 1 },
              avgPrice: { $avg: "$price" },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              year: "$_id",
              count: 1,
              avgPrice: { $round: ["$avgPrice", 0] },
            },
          },
        ]),
        Car.countDocuments(PUBLIC_LISTING_FILTER),
        Car.aggregate([
          publicMatch,
          {
            $group: {
              _id: null,
              avgPrice: { $avg: "$price" },
            },
          },
        ]),
      ]);

      return {
        byBrand,
        byYear,
        totalCars,
        overallAvgPrice: Math.round(overall[0]?.avgPrice || 0),
      };
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return NextResponse.json(
      { error: "İstatistikler yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
