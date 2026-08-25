import Link from "next/link";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { Offer } from "@/models/Offer";
import { Question } from "@/models/Question";
import { getCurrentUser } from "@/lib/auth";
import { serializeOffer, type LeanOffer } from "@/lib/serialize-offer";
import { statusLabel } from "@/lib/offers";
import { formatPrice, formatNumber } from "@/lib/utils";
import { CarThumb } from "@/components/CarThumb";
import { ListingQuestions } from "@/components/ListingQuestions";
import { ListingStatusToggle } from "@/components/ListingStatusToggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "İlanlarım | OtoPiyasa" };

const TONE: Record<string, string> = {
  accepted: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
  rejected: "border-red-400/30 bg-red-500/15 text-red-300",
  expired: "border-white/10 bg-white/5 text-slate-400",
  pending: "border-amber-400/30 bg-amber-500/15 text-amber-300",
};

const MOD_TONE: Record<string, string> = {
  approved: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
  pending: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  rejected: "border-red-400/30 bg-red-500/15 text-red-300",
};

const MOD_LABEL: Record<string, string> = {
  approved: "Yayında",
  pending: "Moderasyonda",
  rejected: "Reddedildi",
};

const LISTING_STATUS_META: Record<string, { label: string; cls: string }> = {
  sold: { label: "Satıldı", cls: "border-white/15 bg-white/10 text-slate-300" },
  removed: { label: "Kaynaktan kaldırıldı", cls: "border-white/15 bg-white/10 text-slate-400" },
};

/**
 * SATICI PANELİ: kendi ilanlarım + her ilana gelen teklifler + bekleyen sorular.
 *
 * "Tekliflerim"den ayrı bir sekme olmasının sebebi: orası alıcı olarak VERDİĞİM
 * teklifleri gösteriyor. Satıcı tarafındaki iş (gelen teklifi yanıtla, soruyu
 * cevapla, ilanı güncelle) ilanın kendisiyle birlikte durunca çok daha anlaşılır.
 */
export default async function ListingsPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/listings");

  await connectDB();
  const cars = await Car.find({ ownerId: viewer.userId })
    .sort({ createdAt: -1 })
    .select("title brand model year price mileage city address imageUrl moderationStatus rejectionReason minOffer status viewCount")
    .lean<
      {
        _id: { toString(): string };
        title: string; price: number; mileage: number; city: string; address?: string;
        imageUrl: string; moderationStatus?: string; rejectionReason?: string; minOffer?: number;
        status?: "active" | "sold" | "removed"; viewCount?: number;
      }[]
    >();

  const carIds = cars.map((c) => c._id);

  const [offerRows, questionRows] = await Promise.all([
    Offer.find({ car: { $in: carIds } })
      .sort({ updatedAt: -1 })
      .populate({ path: "car", model: Car, select: "title imageUrl price contactPhone _id" })
      .populate({ path: "buyer", model: User, select: "name" })
      .populate({ path: "seller", model: User, select: "name" })
      .lean() as unknown as Promise<LeanOffer[]>,
    Question.find({ car: { $in: carIds } })
      .sort({ createdAt: -1 })
      .populate({ path: "asker", model: User, select: "name" })
      .lean<
        {
          _id: { toString(): string };
          car: { toString(): string };
          text: string; answer: string; asker?: { name?: string };
        }[]
      >(),
  ]);

  const offers = offerRows.map((o) => serializeOffer(o, viewer.userId));

  if (cars.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-10 text-center">
        <h1 className="text-3xl font-black">İlanlarım</h1>
        <p className="text-slate-400">Henüz ilan vermedin.</p>
        <Link href="/sell" className="btn btn-primary inline-flex">
          İlk ilanını ver
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">İlanlarım</h1>
          <p className="text-sm text-slate-400">
            İlanlarını güncelle, gelen teklifleri yanıtla ve soruları cevapla.
          </p>
        </div>
        <Link href="/sell" className="btn btn-primary">
          Yeni ilan ver
        </Link>
      </div>

      {cars.map((car) => {
        const id = car._id.toString();
        const carOffers = offers.filter((o) => o.carId === id);
        const carQuestions = questionRows.filter((q) => q.car.toString() === id);
        const unanswered = carQuestions.filter((q) => !q.answer).length;
        const modStatus = car.moderationStatus || "approved";
        const listingStatus = car.status && car.status !== "active" ? LISTING_STATUS_META[car.status] : null;

        return (
          <section key={id} className="card space-y-4 p-5">
            <div className="flex flex-wrap items-start gap-4">
              <Link
                href={`/cars/${id}`}
                className="relative block h-24 w-36 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-soft)]"
              >
                <CarThumb src={car.imageUrl} alt={car.title} className="object-cover" />
              </Link>

              <div className="min-w-0 flex-1">
                <Link href={`/cars/${id}`} className="font-bold hover:text-amber-300">
                  {car.title}
                </Link>
                <p className="text-sm text-slate-400">
                  {formatPrice(car.price)} • {formatNumber(car.mileage)} km •{" "}
                  {car.address?.trim() || car.city}
                  {typeof car.viewCount === "number" && ` • ${formatNumber(car.viewCount)} görüntülenme`}
                </p>
                {car.minOffer ? (
                  <p className="text-xs text-slate-500">
                    En düşük kabul ettiğin teklif: {formatPrice(car.minOffer)}
                  </p>
                ) : null}
                {modStatus === "rejected" && car.rejectionReason && (
                  <p className="mt-1 text-xs text-red-300">Sebep: {car.rejectionReason}</p>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  {listingStatus && <span className={`badge ${listingStatus.cls}`}>{listingStatus.label}</span>}
                  <span className={`badge ${MOD_TONE[modStatus] || ""}`}>
                    {MOD_LABEL[modStatus] || modStatus}
                  </span>
                </div>
                {modStatus === "approved" && car.status !== "removed" && (
                  <ListingStatusToggle carId={id} status={car.status || "active"} />
                )}
                <Link href={`/sell/${id}`} className="btn btn-secondary text-sm">
                  Düzenle
                </Link>
              </div>
            </div>

            {/* Gelen teklifler */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">
                Gelen teklifler{" "}
                <span className="text-slate-500">({carOffers.length})</span>
              </h3>
              {carOffers.length === 0 ? (
                <p className="text-sm text-slate-500">Bu ilana henüz teklif gelmedi.</p>
              ) : (
                <ul className="space-y-1.5">
                  {carOffers.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/offers/${o.id}`}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm transition hover:border-amber-400/40"
                      >
                        <strong className="text-amber-300">{formatPrice(o.amount)}</strong>
                        <span className="text-slate-400">{o.counterpartName}</span>
                        <span className={`badge ml-auto ${TONE[o.status] || ""}`}>
                          {statusLabel(o.status)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Sorular — buradan doğrudan yanıtlanabilir */}
            <ListingQuestions
              carId={id}
              initialCount={carQuestions.length}
              unanswered={unanswered}
            />
          </section>
        );
      })}
    </div>
  );
}
