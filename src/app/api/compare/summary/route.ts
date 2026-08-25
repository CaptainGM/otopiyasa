import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { compareCarsSummary, CompareCarInput, isGeminiConfigured } from "@/lib/gemini";
import { checkAiRateLimit } from "@/lib/ai-guard";

/** Karşılaştırılabilecek en fazla araç (istem kısa kalsın). */
const MAX_CARS = 4;

/** Gemini metin üretimi 4-7 sn sürüyor; Vercel'in 10 sn varsayılanı riskli. */
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    // Herkese açık + her istek Gemini kotası harcıyor → hız sınırı.
    const limited = checkAiRateLimit(request, "compare");
    if (limited) return limited;

    if (!isGeminiConfigured()) {
      return NextResponse.json({ summary: null, reason: "gemini-unconfigured" });
    }

    const body = await request.json().catch(() => ({}));

    /**
     * GÜVENLİK: Araç bilgileri artık istemciden GELMİYOR, yalnızca kimlikler
     * geliyor ve veriler veritabanından okunuyor.
     *
     * Öncesinde `title`, `brand`, `city`… doğrudan istemcinin gönderdiği metindi
     * ve düz metin olarak Gemini istemine giriyordu. Bu iki kapı açıyordu:
     * (1) istem enjeksiyonu — `title` alanına talimat yazıp modeli OtoPiyasa
     * dışında herhangi bir iş için kullanmak, (2) uzunluk sınırı olmadığı için
     * tek istekte büyük miktarda kota yakmak. Kimlikle okuma ikisini de kapatır:
     * istem yalnızca bizim veritabanımızdaki gerçek ilan verisinden kurulur.
     */
    const rawIds: unknown[] = Array.isArray(body.ids) ? body.ids : [];
    const ids = rawIds
      .filter((v): v is string => typeof v === "string" && Types.ObjectId.isValid(v))
      .slice(0, MAX_CARS);

    if (ids.length < 2) {
      return NextResponse.json({ summary: null, reason: "need-two-cars" });
    }

    await connectDB();
    const docs = await Car.find({ _id: { $in: ids } })
      .select("title brand model year price mileage city damageFlag features")
      .lean<
        {
          _id: Types.ObjectId;
          title: string;
          brand: string;
          model: string;
          year: number;
          price: number;
          mileage: number;
          city?: string;
          damageFlag?: boolean;
          features?: { fuelType?: string; transmission?: string };
        }[]
      >();

    if (docs.length < 2) {
      return NextResponse.json({ summary: null, reason: "need-two-cars" });
    }

    // İstemcinin gönderdiği sırayı koru (kullanıcı tablodaki sırayla görüyor)
    const order = new Map(ids.map((id, i) => [id, i]));
    docs.sort((a, b) => (order.get(a._id.toString()) ?? 0) - (order.get(b._id.toString()) ?? 0));

    const cars: CompareCarInput[] = docs.map((c) => ({
      title: c.title,
      brand: c.brand,
      model: c.model,
      year: c.year,
      price: c.price,
      mileage: c.mileage,
      fuelType: c.features?.fuelType,
      transmission: c.features?.transmission,
      city: c.city,
      damageFlag: Boolean(c.damageFlag),
    }));

    const summary = await compareCarsSummary(cars);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("POST /api/compare/summary error:", error);
    return NextResponse.json({ summary: null }, { status: 500 });
  }
}
