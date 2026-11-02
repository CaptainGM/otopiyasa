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
 * "Haftanın fırsatları" şeridi: TÜM aktif ilanlar arasından en yüksek indirimli fırsatlar havuzundan
 * (en iyi 36 fırsat) ana sayfa için değişken / rotasyonlu 12 araç sunar. Böylece kullanıcılar her ana sayfayı
 * ziyaret ettiğinde ya da yenilediğinde sürekli tıpatıp aynı 12 arabayı görmez, vitrin canlı kalır.
 * "Tümünü gör" dendiğinde ise tüm liste indirim oranına göre azalan sırada (`market.disc: -1`) açılır.
 */
export async function getDealStrip(): Promise<{ items: DealStripItem[]; total: number }> {
  const poolData = await cached("home:deal-strip-pool", CACHE_TTL.short, async () => {
    await connectDB();
    const { docs, total } = await findDealListings(36);
    const pool = (docs as unknown[]).filter(isLeanCarDoc).map((doc) => {
      const disc = (doc as unknown as { market?: { disc?: number } }).market?.disc ?? 0;
      return {
        car: serializeCarPublicForList(doc),
        label: `Adil değerin %${Math.round(disc * 100)} altı`,
        score: disc,
      };
    });
    return { pool, total };
  });

  if (!poolData || poolData.pool.length === 0) return { items: [], total: 0 };

  // Ana sayfada sürekli aynı arabalar kilitli kalmasın: havuzdan karıştırılmış 12'lik dinamik vitrin sunulur.
  const shuffled = [...poolData.pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const items = shuffled.slice(0, DEAL_STRIP_LIMIT);
  return { items, total: poolData.total };
}
