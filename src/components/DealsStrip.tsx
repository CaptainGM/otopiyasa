import Link from "next/link";
import { CarThumb } from "@/components/CarThumb";
import { DragScroller } from "@/components/DragScroller";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { getMarketMap } from "@/lib/market-price";
import { attachMarketToCars, isLeanCarDoc, LIST_IMAGE_LIMIT } from "@/lib/serialize-car";
import { formatPrice } from "@/lib/utils";
import { pickDeals, DEAL_MIN_YEAR, DEAL_MAX_MILEAGE, type Deal } from "@/lib/deals";
import { cached, CACHE_TTL } from "@/lib/cache";


async function findDeals(): Promise<Deal[]> {
  try {
    await connectDB();
    
    const docs = ((await Car.find({
      ...PUBLIC_LISTING_FILTER,
      year: { $gte: DEAL_MIN_YEAR },
      mileage: { $lte: DEAL_MAX_MILEAGE },
      damageFlag: { $ne: true },
    })
      .sort({ updatedAt: -1 })
      .limit(400)
      
      .slice("images", LIST_IMAGE_LIMIT)
      .lean()) as unknown[]).filter(isLeanCarDoc);

    const marketMap = await getMarketMap(
      docs.map((car) => ({ brand: car.brand, model: car.model, year: car.year }))
    );
    const cars = attachMarketToCars(docs, marketMap);

    return pickDeals(cars, 8);
  } catch {
    return [];
  }
}

export async function DealsStrip() {

  const deals = await cached("home:deals", CACHE_TTL.medium, findDeals);
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
