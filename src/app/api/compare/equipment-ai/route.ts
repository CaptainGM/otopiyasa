import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { CompareEquipmentGuess } from "@/models/CompareEquipmentGuess";
import { evaluateCarEquipment } from "@/lib/catalog/car-equipment";
import { inferEquipmentGuesses, isGeminiConfigured, type EquipmentGuessCarInput } from "@/lib/gemini";
import { checkAiRateLimit } from "@/lib/ai-guard";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";

const MAX_CARS = 4;
/** Gemini çağrısı birkaç saniye sürebilir; Vercel'in 10 sn varsayılanı riskli. */
export const maxDuration = 30;

/**
 * Donanım kural motorunun "bilinmiyor" bıraktığı öğeler için AI tahmini döner. Araç başına önbelleklenir
 * (CompareEquipmentGuess): aynı ilan tekrar sorulduğunda Gemini'ye gidilmez, aynı cevap döner. Yalnızca önbellekte
 * olmayan öğeler için (ve o öğeler varsa) Gemini çağrılır — hız sınırı da bu yüzden çağrı yapılmadan uygulanmaz.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawIds: unknown[] = Array.isArray(body.ids) ? body.ids : [];
    const ids = rawIds.filter((v): v is string => typeof v === "string" && Types.ObjectId.isValid(v)).slice(0, MAX_CARS);
    if (ids.length === 0) return NextResponse.json({ guesses: {} });

    await connectDB();
    const docs = await Car.find({ _id: { $in: ids }, ...PUBLIC_LISTING_FILTER })
      .select("brand model year title description features")
      .lean<
        Array<{
          _id: Types.ObjectId;
          brand: string;
          model: string;
          year: number;
          title: string;
          description?: string;
          features?: Record<string, unknown>;
        }>
      >();
    if (docs.length === 0) return NextResponse.json({ guesses: {} });

    const cached = await CompareEquipmentGuess.find({ carId: { $in: docs.map((d) => d._id) } }).lean<
      Array<{ carId: Types.ObjectId; guesses?: Record<string, boolean> }>
    >();
    const cacheByCarId = new Map(cached.map((c) => [c.carId.toString(), c.guesses || {}]));

    // Her araç için kuralın "bilinmiyor" bıraktığı ve önbellekte de olmayan öğeleri topla.
    const toAsk: EquipmentGuessCarInput[] = [];
    const result: Record<string, Record<string, boolean>> = {};

    for (const d of docs) {
      const carId = d._id.toString();
      const cachedForCar = cacheByCarId.get(carId) || {};
      result[carId] = { ...cachedForCar };

      const categories = evaluateCarEquipment({
        brand: d.brand,
        model: d.model,
        year: d.year,
        title: d.title,
        description: d.description,
        features: d.features as never,
      });
      const unknownItems = categories
        .flatMap((cat) => cat.items)
        .filter((it) => it.status === "bilinmiyor" && !(it.id in cachedForCar));

      if (unknownItems.length > 0) {
        toAsk.push({
          carId,
          brand: d.brand,
          model: d.model,
          year: d.year,
          title: d.title,
          items: unknownItems.map((it) => ({ id: it.id, name: it.name })),
        });
      }
    }

    if (toAsk.length > 0 && isGeminiConfigured()) {
      const limited = await checkAiRateLimit(request, "compareEquipment");
      // Hız sınırı aşıldıysa hata vermez: önbellekteki kadarıyla döner, kalan öğeler istemci tarafında "Belirtilmemiş" kalır.
      if (!limited) {
        const guesses = await inferEquipmentGuesses(toAsk);
        if (guesses && guesses.length > 0) {
          const byCarId = new Map<string, Record<string, boolean>>();
          for (const g of guesses) {
            if (!result[g.carId]) result[g.carId] = {};
            result[g.carId][g.itemId] = g.present;
            if (!byCarId.has(g.carId)) byCarId.set(g.carId, {});
            byCarId.get(g.carId)![g.itemId] = g.present;
          }
          // Önbelleğe yaz: bir sonraki görüntülemede bu araç için Gemini'ye tekrar sorulmaz.
          await Promise.all(
            [...byCarId.entries()].map(([carId, newGuesses]) => {
              const merged = { ...(cacheByCarId.get(carId) || {}), ...newGuesses };
              return CompareEquipmentGuess.updateOne(
                { carId: new Types.ObjectId(carId) },
                { $set: { guesses: merged, model: "gemini-flash-lite-latest", createdAt: new Date() } },
                { upsert: true }
              );
            })
          );
        }
      }
    }

    return NextResponse.json({ guesses: result });
  } catch (error) {
    console.error("POST /api/compare/equipment-ai error:", error);
    return NextResponse.json({ guesses: {} }, { status: 500 });
  }
}
