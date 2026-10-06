import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { getFuelCostForCar } from "@/lib/fuel-cost-data";
import type { FuelCostInput } from "@/lib/fuel-cost";


/** İlanın km başına yakıt maliyeti (mobil ilan detayı). Bilinmiyorsa `fuelCost: null`. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Araç bulunamadı." }, { status: 404 });
    await connectDB();
    const car = await Car.findById(id)
      .select("brand model title city features.fuelType features.bodyType features.engineSize features.avgFuelConsumption")
      .lean<FuelCostInput | null>();
    if (!car) return NextResponse.json({ error: "Araç bulunamadı." }, { status: 404 });
    // Herkes için aynı; pompa fiyatı saatlik yenilendiği için 1 saat CDN'de.
    return NextResponse.json(
      { fuelCost: await getFuelCostForCar(car) },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" } }
    );
  } catch (error) {
    console.error("GET /api/cars/[id]/fuel-cost error:", error);
    return NextResponse.json({ fuelCost: null });
  }
}
