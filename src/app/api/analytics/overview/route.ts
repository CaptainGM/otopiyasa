import { NextResponse } from "next/server";
import { getAnalyticsData } from "@/lib/analytics-data";

/**
 * Analiz sayfasının verisi JSON olarak (mobil uygulamanın Analiz sekmesi). Web'deki /analytics ile aynı hesap;
 * 6 saat CDN'de tutulur (sayfa da 6 saatte bir yenileniyor), yani günde en çok birkaç fonksiyon çağrısı.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getAnalyticsData();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200" },
    });
  } catch (error) {
    console.error("GET /api/analytics/overview error:", error);
    return NextResponse.json({ error: "Analiz verileri yüklenemedi." }, { status: 500 });
  }
}
