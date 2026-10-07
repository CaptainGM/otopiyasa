import Link from "next/link";
import { CarListItem } from "@/types";
import { formatNumber, formatPrice } from "@/lib/utils";
import { featureChips } from "@/lib/feature-chips";
import { SourceBadge } from "@/components/SourceBadge";
import { CompareButton } from "@/components/CompareButton";
import { CardGallery } from "@/components/CardGallery";
import { ImageLightboxButton } from "@/components/ImageLightboxButton";
import { MarketGauge } from "@/components/MarketGauge";
import { carHeadline } from "@/lib/car-headline";

function priceDropPercent(car: CarListItem): number | null {
  const history = car.priceHistory;
  if (!history || history.length < 2) return null;
  const previous = history[history.length - 2].price;
  const current = history[history.length - 1].price;
  if (current >= previous || previous <= 0) return null;
  return Math.round(((previous - current) / previous) * 100);
}

/**
 * İlan kartı (akış, benzer ilanlar, favoriler). Düzen: fotoğraf → yıl · şehir → marka model → satıcı başlığı →
 * km · yakıt · vites → fiyat → piyasa göstergesi (ucuz/adil/pahalı). Fiyat ve rakamlar eş aralıklı yazıyla,
 * kartlar arasında hizalı okunur.
 */
export function CarCard({
  car,
  priority = false,
}: {
  car: CarListItem;
  /** Geriye dönük uyumluluk; tüm kartlar aynı düzeni kullanır. */
  layout?: "horizontal" | "vertical";
  /** Sayfanın ilk ekranındaki kart: ilk fotoğraf öncelikli yüklenir. */
  priority?: boolean;
}) {
  const gallery = car.images?.filter(Boolean) ?? [];
  if (gallery.length === 0 && car.imageUrl) gallery.push(car.imageUrl);
  const priceDrop = priceDropPercent(car);
  const name = carHeadline(car);
  // Doğrulanmamış özellik yazılmaz; yerine soluk "doğrulanıyor" etiketi çıkar (bkz. feature-chips.ts).
  const specs = [
    { label: `${formatNumber(car.mileage)} km`, pending: false },
    ...featureChips([car.features.fuelType, car.features.transmission]),
  ];
  const href = `/cars/${car._id}`;

  return (
    <article className="card listing-card group flex flex-col overflow-hidden">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[var(--bg-soft)]">
        <CardGallery images={gallery} alt={car.title} href={href} priority={priority} />

        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          <SourceBadge source={car.sourceSite} overlay />
          {car.damageFlag && <span className="badge badge-photo-danger">Hasar kaydı</span>}
          {priceDrop !== null && <span className="badge badge-photo-drop num">↓ %{priceDrop}</span>}
        </div>

        <div className="absolute right-2.5 top-2.5 flex gap-1.5">
          {gallery.length > 0 && <ImageLightboxButton images={gallery} title={car.title} />}
          <CompareButton carId={car._id} variant="icon" />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3.5 sm:p-4">
        <div className="min-w-0 space-y-1">
          <p className="eyebrow truncate !text-[0.7rem]">
            <span className="text-[var(--text)]">{car.year}</span>
            <span className="mx-1.5 text-[var(--faint)]">/</span>
            {car.city}
          </p>
          <Link href={href} prefetch={false} className="block text-inherit">
            <h3 className="font-display line-clamp-1 text-[1.02rem] font-semibold leading-snug transition-colors group-hover:text-[var(--accent)]">
              {name}
            </h3>
          </Link>
          {name !== car.title && (
            <p className="line-clamp-1 text-[0.82rem] text-[var(--muted)]" title={car.title}>
              {car.title}
            </p>
          )}
        </div>

        <p className="num flex flex-wrap gap-x-2 gap-y-0.5 text-[0.78rem] text-[var(--muted)]">
          {specs.map((s, i) => (
            <span key={s.label} className={`whitespace-nowrap ${s.pending ? "italic text-[var(--faint)]" : ""}`}>
              {i > 0 && <span className="mr-2 not-italic text-[var(--faint)]">·</span>}
              {s.pending ? s.label.toLocaleLowerCase("tr") : s.label}
            </span>
          ))}
        </p>

        <div className="mt-auto space-y-2.5 border-t border-[var(--border)] pt-3">
          <p className="num text-[1.35rem] font-semibold leading-none tracking-tight">{formatPrice(car.price)}</p>
          <MarketGauge price={car.price} avg={car.fairPrice} count={car.fairSample} />
        </div>
      </div>
    </article>
  );
}
