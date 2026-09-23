import Link from "next/link";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { Offer } from "@/models/Offer";
import { getCurrentUser } from "@/lib/auth";
import { serializeOffer, type LeanOffer } from "@/lib/serialize-offer";
import { statusLabel } from "@/lib/offers";
import { formatPrice } from "@/lib/utils";
import { CarThumb } from "@/components/CarThumb";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  accepted: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
  rejected: "border-red-400/30 bg-red-500/15 text-red-300",
  expired: "border-white/10 bg-white/5 text-slate-400",
  pending: "border-amber-400/30 bg-amber-500/15 text-amber-300",
};

export default async function OffersPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/offers");

  await connectDB();
  /**
   * Yalnızca ALICI olarak verdiğim teklifler.
   * Satıcı tarafı (ilanlarıma gelen teklifler) artık /listings sayfasında —
   * orada teklif, soru ve düzenleme aynı ilanın altında toplanıyor.
   */
  const rows = (await Offer.find({ buyer: viewer.userId })
    .sort({ updatedAt: -1 })
    .limit(100)
    .populate({ path: "car", model: Car, select: "title imageUrl price contactPhone _id" })
    .populate({ path: "buyer", model: User, select: "name" })
    .populate({ path: "seller", model: User, select: "name" })
    .lean()) as unknown as LeanOffer[];

  const offers = rows.map((o) => serializeOffer(o, viewer.userId));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Tekliflerim</h1>
          <p className="text-sm text-slate-400">
            Verdiğin teklifler ve durumları. Teklif kabul edilirse satıcıyla 48 saat
            boyunca mesajlaşabilirsin.
          </p>
        </div>
        <Link href="/listings" className="btn btn-secondary text-sm">
          İlanlarıma gelen teklifler →
        </Link>
      </div>

      <Section title="Verdiğim teklifler" empty="Henüz teklif vermedin." items={offers} />
    </div>
  );
}

function Section({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: ReturnType<typeof serializeOffer>[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">
        {title} {items.length > 0 && <span className="text-slate-500">({items.length})</span>}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((o) => (
            <div
              key={o.id}
              className="card flex items-center gap-3 p-3 transition hover:border-amber-400/40"
            >
              {/* Fotoğraf İLANA gider (kullanıcı isteği), satırın kalanı kanala. */}
              <Link
                href={`/cars/${o.carId}`}
                title="İlana git"
                className="relative block h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-soft)]"
              >
                <CarThumb src={o.carImage} alt={o.carTitle} className="object-cover" />
              </Link>
              <Link href={`/offers/${o.id}`} className="min-w-0 flex-1">
                <b className="block truncate">{o.carTitle}</b>
                <i className="block text-sm not-italic text-slate-400">
                  Satıcı: {o.counterpartName} •{" "}
                  <strong className="text-amber-300">{formatPrice(o.amount)}</strong>
                </i>
              </Link>
              <span className={`badge shrink-0 ${TONE[o.status] || ""}`}>{statusLabel(o.status)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
