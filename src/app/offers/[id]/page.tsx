import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { Offer } from "@/models/Offer";
import { getCurrentUser } from "@/lib/auth";
import { serializeOffer, type LeanOffer } from "@/lib/serialize-offer";
import { OfferThread } from "@/components/OfferThread";

export const dynamic = "force-dynamic";

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/offers");

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const offer = (await Offer.findById(id)
    .populate({ path: "car", model: Car, select: "title imageUrl price contactPhone _id" })
    .populate({ path: "buyer", model: User, select: "name" })
    .populate({ path: "seller", model: User, select: "name" })
    .lean()) as unknown as LeanOffer | null;

  if (!offer) notFound();

  // Kanalı yalnızca tarafları görebilir.
  const idOf = (r: unknown) => {
    const o = r as { _id?: { toString(): string } } | null;
    return o?._id ? o._id.toString() : "";
  };
  if (idOf(offer.buyer) !== viewer.userId && idOf(offer.seller) !== viewer.userId) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/offers" className="text-sm text-amber-300 hover:underline">
        ← Tüm tekliflerim
      </Link>
      <OfferThread initial={serializeOffer(offer, viewer.userId)} />
    </div>
  );
}
