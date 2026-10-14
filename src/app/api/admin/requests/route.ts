import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { SupportRequest } from "@/models/SupportRequest";
import { requireAdmin } from "@/lib/auth";
import { REQUEST_STATUSES, REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS, type RequestType, type RequestStatus } from "@/lib/support-request";

export const dynamic = "force-dynamic";

const OPEN_STATUSES: RequestStatus[] = ["open", "in_review"];

/** Talep kuyruğu: varsayılan açık ve incelemedekiler; ?status=resolved|rejected|all ile diğerleri. Yalnızca yöneticiler. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });

  const status = new URL(request.url).searchParams.get("status") || "open";
  const filter =
    status === "all"
      ? {}
      : (REQUEST_STATUSES as readonly string[]).includes(status)
        ? { status }
        : { status: { $in: OPEN_STATUSES } };

  await connectDB();
  const docs = await SupportRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate({ path: "user", model: User, select: "name email" })
    .populate({ path: "car", model: Car, select: "title" })
    .lean<any[]>();

  const items = docs.map((doc) => ({
    id: String(doc._id),
    type: doc.type,
    typeLabel: REQUEST_TYPE_LABELS[doc.type as RequestType] ?? doc.type,
    subject: doc.subject,
    message: doc.message,
    email: doc.email || doc.user?.email || "",
    name: doc.name || doc.user?.name || "",
    fromAccount: Boolean(doc.user),
    carId: doc.car?._id ? String(doc.car._id) : null,
    carTitle: doc.car?.title || null,
    status: doc.status,
    statusLabel: REQUEST_STATUS_LABELS[doc.status as RequestStatus] ?? doc.status,
    adminNote: doc.adminNote || "",
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    resolvedAt: doc.resolvedAt ? new Date(doc.resolvedAt).toISOString() : null,
  }));

  return NextResponse.json({ items });
}
