import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Report } from "@/models/Report";
import { Car } from "@/models/Car";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/** Bir şikayeti "incelendi" ya da "reddedildi" olarak kapat. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });

  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Geçersiz şikayet." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const status = body.status === "reviewed" ? "reviewed" : body.status === "dismissed" ? "dismissed" : null;
  if (!status) return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });

  await connectDB();
  const report = await Report.findByIdAndUpdate(id, { status }, { new: true }).populate({
    path: "car",
    model: Car,
    select: "title",
  });
  if (!report) return NextResponse.json({ error: "Şikayet bulunamadı." }, { status: 404 });

  await logAudit({
    action: status === "reviewed" ? "report_reviewed" : "report_dismissed",
    actor: admin.name,
    targetLabel: (report.car as unknown as { title?: string } | null)?.title || "",
  });

  return NextResponse.json({ status: report.status });
}
