import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getBrandModelOptions } from "@/lib/brand-models";

/** Web'in marka→model filtresiyle aynı kaynak — mobil uygulama filtre panelini bununla dolduruyor. */
export async function GET() {
  try {
    await connectDB();
    const options = await getBrandModelOptions();
    return NextResponse.json(options);
  } catch (error) {
    console.error("GET /api/filters/brand-models error:", error);
    return NextResponse.json(
      { error: "Marka/model listesi yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
