import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { findCarsPage, parseCarFilters } from "@/lib/car-query";
import { getMarketMap } from "@/lib/market-price";
import { attachMarketToCars, isLeanCarDoc } from "@/lib/serialize-car";

export async function GET(request: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const filters = parseCarFilters(searchParams);
    const { docs: rawItems, total, page, limit } = await findCarsPage(filters);
    const docs = rawItems.filter(isLeanCarDoc);
    const marketMap = await getMarketMap(
      docs.map((car) => ({
        brand: car.brand,
        model: car.model,
        year: car.year,
      }))
    );
    const items = attachMarketToCars(docs, marketMap);

    return NextResponse.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error("GET /api/cars error:", error);
    return NextResponse.json(
      { error: "Araçlar yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
