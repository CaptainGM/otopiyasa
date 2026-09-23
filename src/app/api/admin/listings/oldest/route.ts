import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const source = searchParams.get("source") || "all";
    const sortBy = searchParams.get("sortBy") || "updatedAt"; // "updatedAt" | "createdAt"

    await connectDB();

    const query: Record<string, any> = {
      status: { $ne: "removed" },
    };

    if (source && source !== "all") {
      query.sourceSite = source;
    }

    const sortOption: Record<string, 1 | -1> =
      sortBy === "createdAt" ? { createdAt: 1 } : { updatedAt: 1 };

    const skip = (page - 1) * limit;

    const [total, cars] = await Promise.all([
      Car.countDocuments(query),
      Car.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .select("title brand model year price mileage city imageUrl sourceSite listingUrl externalId createdAt updatedAt")
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      success: true,
      cars,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("Oldest listings API error:", error);
    return NextResponse.json(
      { error: error?.message || "Sunucu hatası" },
      { status: 500 }
    );
  }
}
