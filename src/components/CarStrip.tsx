import Link from "next/link";
import type { ReactNode } from "react";
import { CarThumb } from "@/components/CarThumb";
import { DragScroller } from "@/components/DragScroller";
import { carHeadline } from "@/lib/car-headline";
import { formatPrice } from "@/lib/utils";

/**
 * Ana sayfa şeritleri (son baktıkların, yakındakiler, fırsatlar, en çok bakılanlar) için ortak başlık ve küçük kart.
 * Sunucu ve istemci bileşenlerinden kullanılabilir (kendi başına "use client" değildir).
 */
export function CarStrip({
  eyebrow,
  title,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  /** Başlığın sağındaki küçük eylem (ör. "Geçmişi temizle"). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="font-display text-xl font-semibold">{title}</h2>
        </div>
        {aside}
      </div>
      <DragScroller className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">{children}</DragScroller>
    </section>
  );
}

type Tone = "cheap" | "neutral";

export function MiniCarCard({
  car,
  tag,
  tone = "neutral",
}: {
  car: { _id: string; title: string; brand?: string; model?: string; year: number; city: string; price: number; imageUrl?: string; images?: string[] };
  /** Fotoğraf üstündeki küçük etiket ("%14 ucuz", "1.240 görüntülenme"). */
  tag?: string;
  tone?: Tone;
}) {
  return (
    <Link href={`/cars/${car._id}`} prefetch={false} className="card listing-card group w-56 shrink-0 overflow-hidden sm:w-60">
      <div className="relative aspect-[16/10] w-full bg-[var(--bg-soft)]">
        <CarThumb
          src={car.imageUrl || ""}
          fallbacks={car.images}
          alt={car.title}
          sizes="240px"
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        {tag && (
          <span className={`badge num absolute left-2 top-2 ${tone === "cheap" ? "badge-photo-drop" : "badge-glass"}`}>{tag}</span>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="eyebrow truncate !text-[0.62rem]">
          <span className="text-[var(--text)]">{car.year}</span>
          <span className="mx-1.5 text-[var(--faint)]">/</span>
          {car.city}
        </p>
        <p className="font-display line-clamp-1 text-[0.95rem] font-semibold">{carHeadline(car)}</p>
        <p className="num pt-0.5 text-lg font-semibold tracking-tight">{formatPrice(car.price)}</p>
      </div>
    </Link>
  );
}
