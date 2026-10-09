import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/auth";
import { User } from "@/models/User";
import { UserAvatar } from "@/models/UserAvatar";

/** Yönetici: uygunsuz bulduğu profil fotoğrafını kaldırır (denetim kaçırabilir). Kullanıcı harf rozetine döner. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: "Geçersiz kullanıcı." }, { status: 400 });
    await connectDB();
    await User.updateOne({ _id: id }, { $set: { avatarType: null, avatarPreset: null }, $inc: { avatarVersion: 1 } });
    await UserAvatar.deleteOne({ userId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/users/[id]/avatar error:", error);
    return NextResponse.json({ error: "Fotoğraf kaldırılamadı." }, { status: 500 });
  }
}
