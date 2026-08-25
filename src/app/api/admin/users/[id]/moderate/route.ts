import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { requireAdmin } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import { logAudit } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const ALLOWED_MUTE_DAYS = [1, 3, 7, 30] as const;

/** Şikayet incelemesi sonrası: kullanıcıyı uyar (bildirim) ya da sohbette geçici sustur. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });

  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Geçersiz kullanıcı." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action === "mute" ? "mute" : body.action === "warn" ? "warn" : null;
  if (!action) return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });

  const days = ALLOWED_MUTE_DAYS.includes(body.days) ? (body.days as number) : 3;

  await connectDB();
  const user = await User.findById(id).select("name muteCount");
  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

  if (action === "mute") {
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    user.chatSuspendedUntil = until;
    user.muteCount = (user.muteCount || 0) + 1;
    await user.save();

    await logAudit({
      action: "user_muted",
      actor: admin.name,
      targetLabel: user.name,
      reason: `${days} gün (${user.muteCount}. kez)`,
    });
    await createNotification({
      userId: user._id.toString(),
      type: "report",
      title: "Sohbet erişimin geçici olarak durduruldu",
      body:
        `Bir şikayet incelemesi sonrası ${days} gün boyunca teklif sohbetlerinde mesaj gönderemeyeceksin.` +
        (user.muteCount >= 3
          ? " Bu, tekrarlayan bir ihlal — devam etmesi hâlinde hesabın daha uzun süreliğine kısıtlanabilir."
          : ""),
      link: "/offers",
    });

    return NextResponse.json({ chatSuspendedUntil: until, muteCount: user.muteCount });
  }

  await logAudit({ action: "user_warned", actor: admin.name, targetLabel: user.name });
  await createNotification({
    userId: user._id.toString(),
    type: "report",
    title: "Davranış uyarısı",
    body: "Bir şikayet incelendi. Lütfen sohbetlerde platform kurallarına dikkat et.",
    link: "/offers",
  });

  return NextResponse.json({ success: true });
}
