import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { predictPrice, Condition } from "@/lib/price-prediction";
import { checkRateLimit } from "@/lib/api-rate-limit";

export async function POST(request: Request) {
  try {
    // DB üzerinde regresyon çalıştıran uç nokta — diğer veri uçlarıyla tutarlı
    // olsun ve tekrarlı çağrılarla Atlas'a gereksiz yük binmesin diye sınırlı.
    const limited = checkRateLimit(request, "predict-price", { limit: 60, windowMs: 10 * 60 * 1000 });
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const brand = typeof body.brand === "string" ? body.brand.trim() : "";
    const model = typeof body.model === "string" ? body.model.trim() : "";
    const year = Number(body.year);
    const mileage = Number(body.mileage);
    const condition: Condition =
      body.condition === "damaged" || body.condition === "painted"
        ? body.condition
        : "clean";

    if (!brand || !model || !Number.isFinite(year) || !Number.isFinite(mileage)) {
      return NextResponse.json(
        { error: "brand, model, year ve mileage zorunludur." },
        { status: 400 }
      );
    }

    await connectDB();
    const result = await predictPrice(brand, model, year, mileage, condition);

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/predict-price error:", error);
    return NextResponse.json(
      { error: "Fiyat tahmini yapılamadı." },
      { status: 500 }
    );
  }
}
