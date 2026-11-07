import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { readJson } from "@/lib/http";
import { connectDB } from "@/lib/mongodb";
import { Notification } from "@/models/Notification";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Kullanıcının bildirimleri + okunmamış sayısı. */
export async function GET(request: Request) {
  const authUser = await getCurrentUser();
  if (!authUser) return NextResponse.json({ items: [], unread: 0 });

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 30, 100);
  const unreadOnly = url.searchParams.get("unread") === "1" || url.searchParams.get("unread") === "true";

  await connectDB();
  const filter: Record<string, unknown> = { user: authUser.userId };
  if (unreadOnly) filter.read = false;

  const [items, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ user: authUser.userId, read: false }),
  ]);

  return NextResponse.json({
    unread,
    items: items.map((n) => ({
      _id: (n._id as { toString(): string }).toString(),
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt,
    })),
  });
}

/** Bildirimleri okundu işaretle (id verilmezse tümü). */
export async function POST(request: Request) {
  const authUser = await getCurrentUser();
  if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const body = await readJson(request);
  const filter: Record<string, unknown> = { user: authUser.userId, read: false };
  if (body.id !== undefined && body.id !== null && body.id !== "") {
    // Geçersiz kimlik Mongo'da CastError (500) veriyordu.
    if (typeof body.id !== "string" || !Types.ObjectId.isValid(body.id)) {
      return NextResponse.json({ error: "Geçersiz bildirim." }, { status: 400 });
    }
    filter._id = body.id;
  }

  await connectDB();

  await Notification.updateMany(filter, { $set: { read: true } });
  return NextResponse.json({ success: true });
}

/** Bildirimi tek tek veya topluca siler. */
export async function DELETE(request: Request) {
  const authUser = await getCurrentUser();
  if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const url = new URL(request.url);
  let id = url.searchParams.get("id");

  if (!id) {
    try {
      const body = await request.json().catch(() => null);
      if (body?.id) id = String(body.id);
    } catch {
      // Body boş olabilir
    }
  }

  await connectDB();

  if (id) {
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Geçersiz bildirim." }, { status: 400 });
    }
    await Notification.deleteOne({ _id: id, user: authUser.userId });
    return NextResponse.json({ success: true, deletedId: id });
  }

  // id verilmediyse kullanıcının tüm bildirimlerini temizle
  await Notification.deleteMany({ user: authUser.userId });
  return NextResponse.json({ success: true, all: true });
}
