import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { requireAdmin } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import { isMailerConfigured, sendBusinessDecisionEmail } from "@/lib/mailer";
import { logAudit } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/** Bekleyen işletme başvurularını listeler (admin). */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });

  await connectDB();
  const pending = await User.find({ businessStatus: "pending" })
    .select("name email businessName businessPhone createdAt")
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json({
    items: pending.map((u) => ({ ...u, _id: (u._id as { toString(): string }).toString() })),
  });
}

/** İşletme başvurusunu onayla/reddet (admin) → kullanıcıya bildirim + e-posta. */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });

    const { userId, approve, reason } = await request.json();
    if (!userId) return NextResponse.json({ error: "userId zorunludur." }, { status: 400 });

    await connectDB();
    const user = await User.findById(userId);
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

    const approved = Boolean(approve);
    user.businessStatus = approved ? "approved" : "rejected";
    user.businessRejectionReason = approved ? "" : String(reason || "").slice(0, 500);
    await user.save();

    await logAudit({
      action: approved ? "business_approved" : "business_rejected",
      actor: admin.name,
      targetLabel: user.businessName || user.email,
      reason: user.businessRejectionReason,
    });

    await createNotification({
      userId: user._id.toString(),
      type: "business",
      title: approved ? "İşletme hesabın onaylandı" : "İşletme başvurun onaylanmadı",
      body: approved
        ? `${user.businessName} işletme hesabın aktif.`
        : user.businessRejectionReason || "Başvurun onaylanmadı.",
      link: "/profile",
    });

    if (user.email && isMailerConfigured()) {
      sendBusinessDecisionEmail(user.email, {
        approved,
        businessName: user.businessName,
        reason: user.businessRejectionReason,
      }).catch((e) => console.warn("sendBusinessDecisionEmail failed:", e));
    }

    return NextResponse.json({ status: user.businessStatus });
  } catch (error) {
    console.error("POST /api/admin/business error:", error);
    return NextResponse.json({ error: "İşlem başarısız." }, { status: 500 });
  }
}
