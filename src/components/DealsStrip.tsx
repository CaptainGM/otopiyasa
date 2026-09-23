import Link from "next/link";
import { CarThumb } from "@/components/CarThumb";
import { DragScroller } from "@/components/DragScroller";
import { connectDB } from "@/lib/mongodb";
import { formatPrice } from "@/lib/utils";
import { findGlobalDeals, type Deal } from "@/lib/deals";
import { cached, CACHE_TTL } from "@/lib/cache";

async function findDeals(): Promise<Deal[]> {
  try {
    await connectDB();
    return findGlobalDeals(30);
  } catch {
    return [];
  }
}

export async function DealsStrip() {
  const deals = await cached("home:deals:global", CACHE_TTL.long, findDeals);
  if (deals.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold tracking-tight">Haftanın fırsatları</h2>
        <span className="badge border-emerald-400/30 bg-emerald-500/15 text-emerald-300">
          {deals.length} araç
        </span>
      </div>
      <DragScroller className="flex gap-4 overflow-x-auto pb-2">
        {deals.map(({ car, label }) => (
          <Link
            key={car._id}
            href={`/cars/${car._id}`}
            className="card group w-60 shrink-0 overflow-hidden transition hover:-translate-y-1"
          >
            <div className="relative h-32 w-full bg-[var(--bg-soft)]">
              <CarThumb
                src={car.imageUrl}
                fallbacks={car.images}
                alt={car.title}
                sizes="240px"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute left-2 top-2 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[11px] font-bold text-emerald-950">
                {label}
              </span>
            </div>
            <div className="space-y-1 p-3">
              <p className="line-clamp-1 text-sm font-semibold">{car.title}</p>
              <p className="text-xs text-slate-500">
                {car.year} • {car.city}
              </p>
              <p className="text-lg font-black text-emerald-300">{formatPrice(car.price)}</p>
            </div>
          </Link>
        ))}
      </DragScroller>
    </section>
  );
}
