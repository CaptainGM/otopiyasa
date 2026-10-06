import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { getNavbarUser } from "@/lib/auth";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";

/**
 * İlan görüntülenme sayacı. İlan sayfası önbellekten geldiği için sayaç tarayıcıdan bir kez bildirilir
 * (bkz. components/ListingViewerIslands.tsx ViewCounter). İlan sahibi kendi ilanına bakınca artmaz.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) return new NextResponse(null, { status: 204 });
  try {
    // Sayaç kolayca şişirilmesin ("En çok görüntülenenler" şeridi buna bakıyor): IP başına dakikada 20 ilan.
    const limited = await checkSharedRateLimit(request, "view-count", { limit: 20, windowMs: 60 * 1000 });
    if (limited) return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
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
