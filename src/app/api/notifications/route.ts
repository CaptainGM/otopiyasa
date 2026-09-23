import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Notification } from "@/models/Notification";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Kullanıcının bildirimleri + okunmamış sayısı. */
export async function GET() {
  const authUser = await getCurrentUser();
  if (!authUser) return NextResponse.json({ items: [], unread: 0 });

  await connectDB();
  const [items, unread] = await Promise.all([
    Notification.find({ user: authUser.userId }).sort({ createdAt: -1 }).limit(30).lean(),
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

  const body = await request.json().catch(() => ({}));
  await connectDB();

  const filter: Record<string, unknown> = { user: authUser.userId, read: false };
  if (body.id) filter._id = body.id;

  await Notification.updateMany(filter, { $set: { read: true } });
  return NextResponse.json({ success: true });
}
