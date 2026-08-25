import { NextResponse } from "next/server";
import { fetchArabamMarketAverage } from "@/lib/live-market";

// Basit bellek içi önbellek: aynı marka/model için tekrar tekrar canlı sorgu atmayalım.
const cache = new Map<string, { data: unknown; expires: number }>();
const TTL_MS = 1000 * 60 * 30; // 30 dakika

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brand = (searchParams.get("brand") || "").trim();
  const model = (searchParams.get("model") || "").trim();

  if (!brand || !model) {
    return NextResponse.json(
      { error: "brand ve model parametreleri zorunludur." },
      { status: 400 }
    );
  }

  const key = `${brand.toLowerCase()}::${model.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const result = await fetchArabamMarketAverage(brand, model);
    if (!result) {
      return NextResponse.json(
        { error: "Bu model için canlı fiyat verisi bulunamadı." },
        { status: 404 }
      );
    }
    cache.set(key, { data: result, expires: Date.now() + TTL_MS });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Canlı piyasa verisi alınamadı." },
      { status: 500 }
    );
  }
}
