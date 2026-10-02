import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getBrandModelOptions } from "@/lib/brand-models";

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
      return NextResponse.json({ brands: options.brands, brandFamilies: options.brandFamilies });
    }
    return NextResponse.json(options);
  } catch (error) {
    console.error("GET /api/filters/brand-models error:", error);
    return NextResponse.json(
      { error: "Marka/model listesi yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
