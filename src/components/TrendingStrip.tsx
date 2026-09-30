import Link from "next/link";
import { CarThumb } from "@/components/CarThumb";
import { DragScroller } from "@/components/DragScroller";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { attachMarketToCars, isLeanCarDoc } from "@/lib/serialize-car";
import { formatPrice } from "@/lib/utils";
import { pickTrending } from "@/lib/trending";
import { cached, CACHE_TTL } from "@/lib/cache";
import { Car as CarType } from "@/types";

async function findTrending(): Promise<CarType[]> {
  try {
    await connectDB();
    const docs = ((await Car.find({ ...PUBLIC_LISTING_FILTER, viewCount: { $gt: 0 } })
      .sort({ viewCount: -1 })
      .limit(100)
      .slice("images", 2)
      .lean()) as unknown[]).filter(isLeanCarDoc);

    // This strip shows only views/title/year/city/price; market aggregates were
    // never rendered here and caused an unnecessary multi-segment DB scan.
    const cars = attachMarketToCars(docs, new Map());

    return pickTrending(cars, 30);
  } catch {
    return [];
  }
}

export async function TrendingStrip() {
  const trending = await cached("home:trending", CACHE_TTL.medium, findTrending);
  if (trending.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold tracking-tight">En çok görüntülenenler</h2>
      </div>
      <DragScroller className="flex gap-4 overflow-x-auto pb-2">
        {trending.map((car) => (
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
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-slate-200">
                👁 {car.viewCount}
              </span>
            </div>
            <div className="space-y-1 p-3">
              <p className="line-clamp-1 text-sm font-semibold">{car.title}</p>
              <p className="text-xs text-slate-500">
                {car.year} • {car.city}
              </p>
              <p className="text-lg font-black text-amber-300">{formatPrice(car.price)}</p>
            </div>
          </Link>
        ))}
      </DragScroller>
    </section>
  );
}
