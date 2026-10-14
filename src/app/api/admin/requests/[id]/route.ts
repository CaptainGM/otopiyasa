import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { SupportRequest } from "@/models/SupportRequest";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";
import { ADMIN_NOTE_MAX, REQUEST_STATUSES, type RequestStatus } from "@/lib/support-request";

export const dynamic = "force-dynamic";

/** Talebin durumunu ya da yönetici notunu güncelle. Yalnızca yöneticiler; her değişiklik denetim kaydına yazılır. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });

  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Geçersiz talep." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  let nextStatus: RequestStatus | null = null;

  if (body.status !== undefined) {
    if (!(REQUEST_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
    }
    nextStatus = body.status as RequestStatus;
    set.status = nextStatus;
    if (nextStatus === "resolved" || nextStatus === "rejected") set.resolvedAt = new Date();
    else unset.resolvedAt = 1;
  }
  if (body.adminNote !== undefined) {
    set.adminNote = String(body.adminNote ?? "").trim().slice(0, ADMIN_NOTE_MAX);
  }
  if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
  }

  await connectDB();
  const update: Record<string, unknown> = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  const doc = await SupportRequest.findByIdAndUpdate(id, update, { new: true }).lean<{ subject: string } | null>();
  if (!doc) return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });

  if (nextStatus) {
    await logAudit({
      action: "request_updated",
      actor: admin.email,
      targetLabel: doc.subject.slice(0, 80),
      reason: `durum: ${nextStatus}`,
    });
  }
  return NextResponse.json({ ok: true });
}
