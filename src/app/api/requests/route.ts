import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { SupportRequest } from "@/models/SupportRequest";
import { getCurrentUser } from "@/lib/auth";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";
import { createNotification } from "@/lib/notify";
import { REQUEST_TYPE_LABELS, validateRequest, type RequestType } from "@/lib/support-request";

export const dynamic = "force-dynamic";

/** Genel talep / şikayet gönderimi (giriş zorunlu değil; e-posta girilmemişse giriş şart). */
export async function POST(request: Request) {
  // Saatte en çok 5 talep: IP'nin özeti üzerinden; ham IP kaydedilmez.
  const limited = await checkSharedRateLimit(request, "support-request", { limit: 5, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const viewer = await getCurrentUser();
  const check = validateRequest(body && typeof body === "object" ? body : {}, { loggedIn: Boolean(viewer) });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  const value = check.value;
  // Bot: kayıt yok, başarılı yanıt (botun doğrulama yapamaması için).
  if (value.spam) return NextResponse.json({ ok: true }, { status: 201 });

  await connectDB();
  if (value.carId) {
    const exists = await Car.exists({ _id: value.carId });
    if (!exists) return NextResponse.json({ error: "İlgili ilan bulunamadı." }, { status: 400 });
  }

  const doc = await SupportRequest.create({
    type: value.type,
    subject: value.subject,
    message: value.message,
    email: value.email,
    name: value.name,
    user: viewer?.userId || undefined,
    car: value.carId || undefined,
  });

  // Yöneticilere bildirim: kuyruk fark edilmeden kalmasın.
  const admins = await User.find({ role: "admin" }, { _id: 1 }).lean<{ _id: unknown }[]>().catch(() => []);
  const label = REQUEST_TYPE_LABELS[value.type as RequestType];
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: String(admin._id),
        type: "system",
        title: `Yeni talep: ${label}`,
        body: value.subject,
        link: "/admin?tab=sikayet",
      }).catch(() => undefined)
    )
  );

  return NextResponse.json({ ok: true, id: String(doc._id) }, { status: 201 });
}
