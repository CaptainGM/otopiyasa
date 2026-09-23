import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Report } from "@/models/Report";
import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    await connectDB();
    const reports = await Report.find({ status: "open" })
      .populate({ path: "car", model: Car, select: "title price city imageUrl status" })
      .populate({ path: "reporter", model: User, select: "name email" })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({
      items: reports.map((r) => ({
        ...r,
        _id: (r._id as { toString(): string }).toString(),
      })),
    });
  } catch (error: any) {
    console.error("GET /api/admin/reports error:", error);
    return NextResponse.json(
      { error: error?.message || "Raporlar alınamadı" },
      { status: 500 }
    );
  }
}
