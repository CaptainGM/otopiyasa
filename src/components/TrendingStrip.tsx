import { CarStrip, MiniCarCard } from "@/components/CarStrip";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { attachMarketToCars, isLeanCarDoc } from "@/lib/serialize-car";
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

/** Şeritte gösterilen kart sayısı (ana sayfa HTML'i şişmesin). */
const STRIP_LIMIT = 12;

export async function TrendingStrip() {
  const trending = await cached("home:trending", CACHE_TTL.medium, findTrending);
  if (trending.length === 0) return null;
  const shown = trending.slice(0, STRIP_LIMIT);

  return (
    <CarStrip eyebrow="Ziyaretçilerin ilgisi" title="En çok bakılanlar">
      {shown.map((car) => (
        <MiniCarCard key={car._id} car={car} tag={`${(car.viewCount ?? 0).toLocaleString("tr-TR")} görüntülenme`} />
      ))}
    </CarStrip>
  );
}
