import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import {
  UNVERIFIED_ARABAM_FILTER,
  UNVERIFIED_PAGE_SIZE,
  UNVERIFIED_PROJECTION,
  describeVerifyStatus,
} from "@/lib/unverified-listings";

export const dynamic = "force-dynamic";

/** Bekçinin henüz hiç kontrol etmediği Arabam ilanları (sayfalı). Mobil yönetim ekranı kullanır. */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Bu liste yalnızca yöneticiler içindir." }, { status: 401 });
    }
    await connectDB();
    const page = Math.max(1, Math.min(Number(new URL(request.url).searchParams.get("page")) || 1, 10_000));
    const [total, items] = await Promise.all([
      Car.countDocuments(UNVERIFIED_ARABAM_FILTER),
      Car.find(UNVERIFIED_ARABAM_FILTER, UNVERIFIED_PROJECTION)
        .sort({ createdAt: 1, _id: 1 })
        .skip((page - 1) * UNVERIFIED_PAGE_SIZE)
        .limit(UNVERIFIED_PAGE_SIZE)
        .lean(),
    ]);
    return NextResponse.json(
      {
        items: items.map((item: any) => ({ ...item, statusText: describeVerifyStatus(item.lastVerifyStatus, item.lastVerifyAttemptAt) })),
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / UNVERIFIED_PAGE_SIZE)),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("GET /api/admin/unverified error:", error);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }
}
