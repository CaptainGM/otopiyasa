import Link from "next/link";
import { CarListItem } from "@/types";
import { formatNumber, formatPrice } from "@/lib/utils";
import { SourceBadge } from "@/components/SourceBadge";
import { CompareButton } from "@/components/CompareButton";
import { CardGallery } from "@/components/CardGallery";
import { ImageLightboxButton } from "@/components/ImageLightboxButton";

function priceDropPercent(car: CarListItem): number | null {
  const history = car.priceHistory;
  if (!history || history.length < 2) return null;
  const previous = history[history.length - 2].price;
  const current = history[history.length - 1].price;
  if (current >= previous || previous <= 0) return null;
  return Math.round(((previous - current) / previous) * 100);
}

export function CarCard({ car }: { car: CarListItem }) {
  const gallery = car.images?.filter(Boolean) ?? [];
  if (gallery.length === 0 && car.imageUrl) gallery.push(car.imageUrl);
  const priceDrop = priceDropPercent(car);

  return (
    <article className="card group overflow-hidden transition duration-200 hover:border-amber-400/30 hover:bg-white/[0.025]">
      <div className="flex min-h-36 sm:min-h-48 lg:min-h-[240px]">
        <div className="relative w-32 shrink-0 overflow-hidden bg-[var(--bg-soft)] sm:w-60 lg:w-[36%] lg:min-w-[320px] lg:max-w-[480px]">
          <CardGallery images={gallery} alt={car.title} href={`/cars/${car._id}`} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070b12]/75 via-transparent to-transparent" />

          <div className="absolute left-3 top-3 hidden flex-wrap gap-2 sm:flex">
            <SourceBadge source={car.sourceSite} />
            <span className="badge badge-accent">{car.year}</span>
            {car.damageFlag && <span className="badge badge-danger">Hasar Kaydı</span>}
            {priceDrop !== null && (
              <span className="badge border-emerald-400/30 bg-emerald-500/15 text-emerald-300">
                ↓ Fiyat düştü %{priceDrop}
              </span>
            )}
          </div>

          {gallery.length > 0 && (
            <div className="absolute right-3 top-3">
              <ImageLightboxButton images={gallery} title={car.title} />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-3 sm:p-5 lg:p-6">
          <div>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Link href={`/cars/${car._id}`} prefetch={false} className="text-inherit hover:text-amber-300">
                  <h3 className="line-clamp-2 text-sm font-bold leading-snug sm:text-lg lg:text-xl">{car.title}</h3>
                </Link>
                <p className="mt-1 truncate text-xs text-slate-400 sm:text-sm">
                  {car.city} • {formatNumber(car.mileage)} km{car.listingDate ? ` • ${car.listingDate}` : ""}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300 sm:mt-6">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{car.year}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{car.features.fuelType}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{car.features.transmission}</span>
              {car.sourceSite && <span className="sm:hidden"><SourceBadge source={car.sourceSite} /></span>}
              {car.damageFlag && <span className="badge badge-danger">Hasar</span>}
              {priceDrop !== null && <span className="badge border-emerald-400/30 bg-emerald-500/15 text-emerald-300">↓ %{priceDrop}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-3 sm:pt-4">
            <div className="min-w-0">
              <p className="text-lg font-black tracking-tight text-amber-300 sm:text-2xl lg:text-3xl">{formatPrice(car.price)}</p>
            </div>
            <CompareButton carId={car._id} variant="full" />
          </div>
        </div>
      </div>
    </article>
  );
}
