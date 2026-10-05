import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { getNavbarUser } from "@/lib/auth";

/**
 * İlan görüntülenme sayacı. İlan sayfası önbellekten geldiği için sayaç tarayıcıdan bir kez bildirilir
 * (bkz. components/ListingViewerIslands.tsx ViewCounter). İlan sahibi kendi ilanına bakınca artmaz.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) return new NextResponse(null, { status: 204 });
  try {
    await connectDB();
    const viewer = await getNavbarUser();
    await Car.updateOne(
      { _id: id, ...(viewer ? { ownerId: { $ne: new Types.ObjectId(viewer.userId) } } : {}) },
      { $inc: { viewCount: 1 } },
      { timestamps: false }
    );
  } catch {
    // sayaç kritik değil
  }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
