import { connectDB } from "@/lib/mongodb";
import { findDealListings } from "@/lib/market-fair";
import { isLeanCarDoc, serializeCarPublicForList } from "@/lib/serialize-car";
import { cached, CACHE_TTL } from "@/lib/cache";
import type { Car } from "@/types";

/** Şeritte gösterilen fırsat sayısı (web ve mobil aynı). Tamamı "Tümünü gör" ile açılır (/?firsat=1). */
export const DEAL_STRIP_LIMIT = 12;

export interface DealStripItem {
  car: Car;
  label: string;
  /** Adil değerin altında kalma oranı (0,12 = %12). */
  score: number;
}

/**
 * "Haftanın fırsatları" şeridi: TÜM aktif ilanlar arasından adil değerinin en çok altında olan 12 fırsat ve toplam
 * fırsat sayısı. Hesap Oracle'da hazır (market.deal, market.disc); burada yalnızca indeksli sorgu var.
 */
export function getDealStrip(): Promise<{ items: DealStripItem[]; total: number }> {
  return cached("home:deal-strip", CACHE_TTL.medium, async () => {
    await connectDB();
    const { docs, total } = await findDealListings(DEAL_STRIP_LIMIT);
    const items = (docs as unknown[]).filter(isLeanCarDoc).map((doc) => {
      const disc = (doc as unknown as { market?: { disc?: number } }).market?.disc ?? 0;
      return {
        car: serializeCarPublicForList(doc),
        label: `Piyasanın %${Math.round(disc * 100)} altı`,
        score: disc,
      };
    });
    return { items, total };
  });
}
