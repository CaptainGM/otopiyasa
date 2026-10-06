import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { cached, CACHE_TTL } from "@/lib/cache";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { brandStorageAliases } from "@/lib/normalize-brand";
import { modelFamilyRegex } from "@/lib/model-family";
import { turkishSearchRegex } from "@/lib/utils";

/**
 * Piyasa ortalaması kendi yayındaki ilanlarımızdan hesaplanır.
 * Eskiden kaynak sitede `?searchText=` araması yapılıyordu: robots.txt bu aramayı yasaklıyor,
 * Vercel'den yapılan istek Cloudflare'e takıldığı için de her model 404 dönüyordu.
 */
export async function GET(request: Request) {
  const limited = await checkSharedRateLimit(request, "market-average", { limit: 60, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const brand = (searchParams.get("brand") || "").trim().slice(0, 40);
  const model = (searchParams.get("model") || "").trim().slice(0, 60);
  const yearRaw = Number(searchParams.get("year"));
  const year = Number.isInteger(yearRaw) && yearRaw >= 1950 && yearRaw <= 2100 ? yearRaw : null;

  if (!brand || !model) {
    return NextResponse.json({ error: "brand ve model parametreleri zorunludur." }, { status: 400 });
  }

  try {
    const key = `market-average:${brand.toLowerCase()}:${model.toLowerCase()}:${year ?? ""}`;
    const result = await cached(key, CACHE_TTL.long, async () => {
      await connectDB();
      const filter: Record<string, unknown> = {
        ...PUBLIC_LISTING_FILTER,
        brand: { $in: brandStorageAliases(brand).map((b) => new RegExp(`^${turkishSearchRegex(b)}$`, "i")) },
        model: modelFamilyRegex(model, brand),
        price: { $gt: 50_000, $lt: 100_000_000 },
      };
      // Yıl verildiyse ±1 yıl: 2012 bir araçla 2023 aynı modeli ortalamaya karıştırmak anlamsız.
      if (year) filter.year = { $gte: year - 1, $lte: year + 1 };

      const rows = await Car.find(filter).select("price").limit(2000).lean<{ price: number }[]>();
      const prices = rows.map((r) => r.price).sort((a, b) => a - b);
      if (prices.length < 3) return null;

      // Uçlardaki %10 (hatalı girilmiş/aşırı fiyat) ortalamayı bozmasın.
      const cut = prices.length >= 10 ? Math.floor(prices.length * 0.1) : 0;
      const core = prices.slice(cut, prices.length - cut);
      const sum = core.reduce((a, b) => a + b, 0);
      return {
        brand,
        model,
        year,
        avg: Math.round(sum / core.length),
        min: core[0],
        max: core[core.length - 1],
        count: prices.length,
        source: year ? `OtoPiyasa aktif ilanlar (${year - 1}-${year + 1})` : "OtoPiyasa aktif ilanlar",
      };
    });

    if (!result) {
      return NextResponse.json({ error: "Bu model için yeterli ilan yok." }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/market-average error:", error);
    return NextResponse.json({ error: "Piyasa verisi alınamadı." }, { status: 500 });
  }
}
