import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getBrandModelOptions } from "@/lib/brand-models";

/** Liste yalnızca tarama sonrası değişir; CDN bir saat saklasın. */
const LIST_CACHE = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };

/**
 * Web'in marka→model filtresiyle aynı kaynak — mobil uygulama filtre panelini bununla dolduruyor.
 * `?families=1`: yalnızca marka ve model aileleri (tam donanım listesi olmadan, ~10 kat küçük);
 * mobil ekranlar yalnızca aileleri kullandığı için hücresel veride gereksiz 100 KB'ı indirmez.
 */
export async function GET(request: Request) {
  try {
    await connectDB();
    const options = await getBrandModelOptions();
    if (new URL(request.url).searchParams.get("families") === "1") {
      return NextResponse.json({ brands: options.brands, brandFamilies: options.brandFamilies }, { headers: LIST_CACHE });
    }
    return NextResponse.json(options, { headers: LIST_CACHE });
  } catch (error) {
    console.error("GET /api/filters/brand-models error:", error);
    return NextResponse.json(
      { error: "Marka/model listesi yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
