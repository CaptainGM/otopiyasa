import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Comment } from "@/models/Comment";
import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { logAudit } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    await connectDB();

    const comments = await Comment.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate({ path: "car", model: Car, select: "title price imageUrl brand model" })
      .populate({ path: "user", model: User, select: "name email" })
      .lean();

    return NextResponse.json({ success: true, comments });
  } catch (error: any) {
    console.error("GET /api/admin/comments error:", error);
    return NextResponse.json(
      { error: error?.message || "Yorumlar alınamadı" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { commentId, reason } = await request.json();
    if (!commentId) {
      return NextResponse.json({ error: "commentId gereklidir" }, { status: 400 });
    }

    await connectDB();

    const comment = await Comment.findById(commentId)
      .populate({ path: "car", model: Car, select: "title" })
      .populate({ path: "user", model: User, select: "name email" });

    if (!comment) {
      return NextResponse.json({ error: "Yorum bulunamadı" }, { status: 404 });
    }

    const carTitle = (comment.car as any)?.title || "Bilinmeyen İlan";
    const userName = (comment.user as any)?.name || "Bilinmeyen Kullanıcı";

    await Comment.findByIdAndDelete(commentId);

    await logAudit({
      action: "comment_deleted",
      actor: admin.email || "admin",
      targetLabel: `${userName}: "${comment.text.slice(0, 30)}..." (${carTitle})`,
      reason: reason || "Yönetici tarafından silindi",
    });

    return NextResponse.json({
      success: true,
      message: "Yorum başarıyla silindi",
      deletedId: commentId,
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/comments error:", error);
    return NextResponse.json(
      { error: error?.message || "Yorum silinemedi" },
      { status: 500 }
    );
  }
}
