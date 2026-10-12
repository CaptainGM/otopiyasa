import { NextResponse } from "next/server";
import { cached, CACHE_TTL } from "@/lib/cache";
import { loadPriceScale } from "@/lib/price-scale-data";

/**
 * İlanın fiyat skalası (web ilan sayfası ve mobil uygulama aynı veriyi kullanır): aynı model ailesinden emsallerin
 * yıl, km, hasar ve donanım kademelerine göre medyanı, yüzdelik dilimleri ve ilanın konumu. Bkz. lib/price-scale.ts.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return NextResponse.json({ error: "Geçersiz ilan kimliği." }, { status: 400 });
  }
  try {
    const scale = await cached(`price-scale:${id}`, CACHE_TTL.medium, () => loadPriceScale(id));
    if (!scale) {
      return NextResponse.json({ error: "İlan bulunamadı." }, { status: 404 });
    }
    return NextResponse.json(scale);
  } catch (error) {
    console.error("GET /api/cars/[id]/price-scale error:", error);
    return NextResponse.json({ error: "Fiyat skalası hesaplanamadı." }, { status: 500 });
  }
}
