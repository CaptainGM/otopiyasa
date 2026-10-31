import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    await connectDB();
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 40, 100);

    const cars = await Car.find(
      { status: "active" },
      { title: 1, price: 1, city: 1, sourceSite: 1, externalId: 1, createdAt: 1, updatedAt: 1 }
    )
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      cars: cars.map((c) => ({
        ...c,
        _id: String(c._id),
      })),
    });
  } catch (error: any) {
    console.error("GET /api/admin/listings error:", error);
    return NextResponse.json(
      { error: error?.message || "İlanlar alınamadı" },
      { status: 500 }
    );
  }
}
