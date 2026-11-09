import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Notification } from "@/models/Notification";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Tek bir bildirimi sil */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authUser = await getCurrentUser();
  if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Geçersiz bildirim ID." }, { status: 400 });
  }

  await connectDB();
  await Notification.deleteOne({ _id: id, user: authUser.userId });
  return NextResponse.json({ success: true, deletedId: id });
}

/** Tek bir bildirimi okundu olarak işaretle */
export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authUser = await getCurrentUser();
  if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Geçersiz bildirim ID." }, { status: 400 });
  }

  await connectDB();
  await Notification.updateOne({ _id: id, user: authUser.userId }, { $set: { read: true } });
  return NextResponse.json({ success: true });
}

