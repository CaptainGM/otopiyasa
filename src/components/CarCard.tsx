import Link from "next/link";
import { Car } from "@/types";
import { formatNumber, formatPrice } from "@/lib/utils";
import { SourceBadge } from "@/components/SourceBadge";
import { MarketPriceBadge } from "@/components/MarketPriceBadge";
import { CompareButton } from "@/components/CompareButton";
import { CardGallery } from "@/components/CardGallery";
import { ImageLightboxButton } from "@/components/ImageLightboxButton";

function priceDropPercent(car: Car): number | null {
  const history = car.priceHistory;
  if (!history || history.length < 2) return null;
  const previous = history[history.length - 2].price;
  const current = history[history.length - 1].price;
  if (current >= previous || previous <= 0) return null;
  return Math.round(((previous - current) / previous) * 100);
}

export function CarCard({ car }: { car: Car }) {
  const gallery = car.images && car.images.length > 0 ? car.images : car.imageUrl ? [car.imageUrl] : [];
  const photoCount = gallery.length;
  const priceDrop = priceDropPercent(car);

  return (
    <Link href={`/cars/${car._id}`} className="card group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1.5">
      <div className="relative h-52 w-full overflow-hidden bg-[var(--bg-soft)]">
        <CardGallery images={gallery} alt={car.title} />
        {/* Sadece dekoratif karartma — pointer-events-none olmazsa altındaki
            galeri oklarının tıklanmasını engelliyor. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070b12] via-[#070b12]/10 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <SourceBadge source={car.sourceSite} />
          <span className="badge badge-accent">{car.year}</span>
          {car.damageFlag && <span className="badge badge-danger">Hasar Kaydı</span>}
          {priceDrop !== null && (
            <span className="badge border-emerald-400/30 bg-emerald-500/15 text-emerald-300">
              ↓ Fiyat düştü %{priceDrop}
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3 flex items-center gap-2">
          {photoCount > 1 && (
            <span
              title={`${photoCount} fotoğraf`}
              className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="9" cy="11" r="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="m21 16-4.5-4-9 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              {photoCount}
            </span>
          )}
          <ImageLightboxButton images={gallery} title={car.title} />
          <CompareButton carId={car._id} />
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-2xl font-black tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.55)]">
            {formatPrice(car.price)}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col space-y-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug">{car.title}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {car.city} • {formatNumber(car.mileage)} km
          </p>
        </div>

        <MarketPriceBadge
          compact
          price={car.price}
          marketAvgPrice={car.marketAvgPrice}
          marketListingCount={car.marketListingCount}
        />

        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            {car.features.fuelType}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            {car.features.transmission}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            {car.features.bodyType}
          </span>
        </div>

        {car.listingDate && (
          <p className="mt-auto flex items-center gap-1.5 pt-1 text-[11px] text-slate-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3.5 9h17M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            İlan tarihi: {car.listingDate}
          </p>
        )}
      </div>
    </Link>
  );
}
