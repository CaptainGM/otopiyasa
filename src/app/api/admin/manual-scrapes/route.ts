import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/auth";
import { ManualScrapeLog } from "@/models/ManualScrapeLog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
    }

    await connectDB();
    const logs = await ManualScrapeLog.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let todayScanned = 0;
    let todayInserted = 0;
    let todayUpdated = 0;
    let todayDeleted = 0;
    let todayDuration = 0;
    let todayOperations = 0;

    for (const log of logs as any[]) {
      if (new Date(log.createdAt) >= todayStart) {
        todayScanned += log.scanned || 0;
        todayInserted += log.inserted || 0;
        todayUpdated += log.updated || 0;
        todayDeleted += log.deleted || 0;
        todayDuration += log.durationSeconds || 0;
        todayOperations += 1;
      }
    }

    const today = {
      date: new Date().toLocaleDateString("tr-TR"),
      scanned: todayScanned,
      inserted: todayInserted,
      updated: todayUpdated,
      deleted: todayDeleted,
      durationSeconds: Math.round(todayDuration * 10) / 10,
      operations: todayOperations,
    };

    return NextResponse.json(
      { success: true, logs, today },
      {
        headers: {
          "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Kayıtlar alınamadı." },
      { status: 500 }
    );
  }
}
