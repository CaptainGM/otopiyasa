import { CarStrip, MiniCarCard } from "@/components/CarStrip";
import { connectDB } from "@/lib/mongodb";
import { findGlobalDeals, type Deal } from "@/lib/deals";
import { cached, CACHE_TTL } from "@/lib/cache";

const STRIP_LIMIT = 12;

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
  // Şeritte ilk 12 fırsat: 30 kartın hepsi ana sayfa HTML'ine gömülüyordu (ziyaret başına ~100 KB).
  const shown = deals.slice(0, STRIP_LIMIT);

  return (
    <CarStrip eyebrow={`Piyasanın altında · ${shown.length} ilan`} title="Haftanın fırsatları">
      {shown.map(({ car, label }) => (
        <MiniCarCard key={car._id} car={car} tag={label} tone="cheap" />
      ))}
    </CarStrip>
  );
}
