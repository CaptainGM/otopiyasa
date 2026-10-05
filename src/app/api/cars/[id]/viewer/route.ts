import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { Offer } from "@/models/Offer";
import { getCurrentUser } from "@/lib/auth";

/**
 * Üye ilanında giriş yapmış ziyaretçiye özel bilgi: ilanın sahibi mi, kaç teklif geldi, (sahibiyse) kendi
 * telefonu. İlan sayfası herkes için aynı önbellekten geldiği için bu kısım ayrıca sorulur.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const empty = NextResponse.json({ isOwner: false, offerCount: 0 }, { headers: { "Cache-Control": "private, no-store" } });
  const { id } = await context.params;
  if (!Types.ObjectId.isValid(id)) return empty;
  const viewer = await getCurrentUser();
  if (!viewer) return empty;
  await connectDB();
  const car = await Car.findById(id).select("ownerId contactPhone").lean<{ ownerId?: Types.ObjectId; contactPhone?: string }>();
  if (!car?.ownerId || car.ownerId.toString() !== viewer.userId) return empty;
  const offerCount = await Offer.countDocuments({ car: id });
  return NextResponse.json(
    { isOwner: true, offerCount, contactPhone: car.contactPhone || "" },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
