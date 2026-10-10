import { Car } from "@/models/Car";
import { buildCarQuery, parseCarFilters } from "@/lib/car-query";
import { getMarketMap, segmentKey } from "@/lib/market-price";
import type { ChatCard } from "@/lib/chatbot";

/**
 * ASİSTANIN ÖNERİ LİSTESİ
 *
 * "Dizel araç öner" gibi bir soruya eskiden yalnızca arama bağlantısı dönüyordu; bağlantı
 * binlerce ilan açıyordu. Artık kriterlere uyan ilanlar puanlanır ve en mantıklı birkaç
 * tanesi kart olarak gösterilir (bağlantı "tümünü gör" için kalır).
 */
export const PICK_LIMIT = 10;
const CANDIDATE_LIMIT = 600;
/** Kullanıcı açıkça istemedikçe öneriye girmeyen hafif ticari/ticari gövde tipleri ve modeller. */
const COMMERCIAL = /panelvan|kamyonet|minib[üu]s|pick-?up|cargo|transit|tourneo|caddy|doblo|transporter|crafter|sprinter|boxer|jumper|ducato|master|kangoo|partner|berlingo|rifter|fiorino|combo|courier|connect|jumpy|expert|proace|vito|trafic|dokker|amarok|hilux|ranger|navara|l200|d-max|fullback|movano|musso|actyon|hafif ticari/i;
const CURRENT_YEAR = new Date().getFullYear();

export interface PickInput {
  price: number;
  year: number;
  vehicleClass?: string;
  mileage: number;
  damageFlag?: boolean;
  marketAvg?: number;
  marketCount?: number;
  /** Aday havuzunun medyan fiyatı: bütçe verilmemiş sorularda pahalı araçların öne çıkmasını engeller. */
  poolMedian?: number;
}

/**
 * Puan: piyasa ortalamasının altında olma (%35), yaş (%25), kilometre (%20), havuza göre fiyat (%20).
 * Emsali az (3'ten az) segmentte fiyat karşılaştırması yapılmaz. Piyasanın %45'inden fazla
 * altındaki fiyat genellikle hatalı/hasarlı ilandır, avantaj sayılmaz. Ağır hasar kaydı düşürür.
 */
export function scorePick(car: PickInput): { score: number; discount: number } {
  let discount = 0;
  if (car.marketAvg && car.marketAvg > 0 && (car.marketCount || 0) >= 3) {
    const raw = 1 - car.price / car.marketAvg;
    discount = raw > 0.45 ? 0 : Math.max(-0.3, raw);
  }
  const discountScore = (discount + 0.3) / 0.75; // -0.3 → 0, 0.45 → 1
  const age = Math.max(0, CURRENT_YEAR - car.year);
  const yearScore = Math.max(0, 1 - age / 25);
  const kmScore = Math.max(0, 1 - Math.min(car.mileage || 0, 350_000) / 350_000);
  // Medyan fiyat 0,5 puan; 4 katı 0, dörtte biri 1 puan.
  const priceScore =
    car.poolMedian && car.poolMedian > 0 && car.price > 0
      ? Math.min(1, Math.max(0, 0.5 - Math.log2(car.price / car.poolMedian) / 4))
      : 0.5;
  const score = 0.35 * discountScore + 0.25 * yearScore + 0.2 * kmScore + 0.2 * priceScore - (car.damageFlag ? 0.25 : 0);
  return { score, discount };
}

interface Candidate {
  _id: { toString(): string };
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  city: string;
  vehicleClass?: string;
  imageUrl?: string;
  damageFlag?: boolean;
  features?: { bodyType?: string };
}

/** Bir arama bağlantısındaki (`/?priceMax=…`) kriterlere göre öne çıkan ilanlar ve toplam sayı. */
export async function pickTopCars(href: string, limit = PICK_LIMIT): Promise<{ cards: ChatCard[]; total: number }> {
  const params = new URL(href, "https://otopiyasa.app").searchParams;
  const query = buildCarQuery(parseCarFilters(params));
  const wantsCommercial = COMMERCIAL.test(`${params.get("model") || ""} ${params.get("q") || ""}`);

  // Aday havuzu kalıcı rastgele sayıdan (rand) rastgele bir noktadan alınır: yalnızca en yeni ilanlar
  // alındığında öneriler hep son model, pahalı araçlarla doluyordu.
  const start = Math.random() * 0.5;
  const [candidates, total] = await Promise.all([
    Car.find({ ...query, rand: { $gte: start } })
      .sort({ rand: 1 })
      .limit(CANDIDATE_LIMIT)
      .select("title brand model year vehicleClass price mileage city imageUrl damageFlag features.bodyType")
      .lean<Candidate[]>(),
    Car.countDocuments(query),
  ]);
  if (candidates.length === 0) return { cards: [], total };

  const prices = candidates.map((c) => c.price).filter((p) => p > 0).sort((a, b) => a - b);
  const poolMedian = prices[Math.floor(prices.length / 2)] || 0;
  const market = await getMarketMap(candidates.map((c) => ({ brand: c.brand, model: c.model, year: c.year, vehicleClass: c.vehicleClass })));
  const seen = new Set<string>();
  const perModel = new Map<string, number>();
  const ranked = candidates
    // Öneride taksi çıkması ve aşırı kilometreli (400 bin üstü) araçlar gösterilmez; listede aranabilirler.
    .filter((c) => c.price > 0 && (c.mileage || 0) <= 400_000 && !/taks[iİı]/i.test(c.title))
    .filter((c) => wantsCommercial || !COMMERCIAL.test(`${c.features?.bodyType || ""} ${c.model} ${c.title}`))
    .map((c) => {
      const stat = market.get(segmentKey(c.brand, c.model, c.year, c.vehicleClass));
      return { car: c, ...scorePick({ ...c, marketAvg: stat?.avgPrice, marketCount: stat?.listingCount, poolMedian }) };
    })
    .sort((a, b) => b.score - a.score)
    // Aynı başlıklı (çoğaltılmış) ilanlar ve tek bir modelin listeyi doldurması engellenir (model başına en fazla 2).
    .filter(({ car }) => {
      const key = `${car.title}|${car.price}`;
      const modelKey = `${car.brand}|${car.model}`.toLocaleLowerCase("tr-TR");
      if (seen.has(key) || (perModel.get(modelKey) || 0) >= 2) return false;
      seen.add(key);
      perModel.set(modelKey, (perModel.get(modelKey) || 0) + 1);
      return true;
    })
    .slice(0, limit);

  const cards = ranked.map(({ car, discount }) => ({
    href: `/cars/${car._id.toString()}`,
    title: car.title,
    price: car.price,
    imageUrl: car.imageUrl || "",
    subtitle: [
      car.year,
      car.mileage ? `${car.mileage.toLocaleString("tr-TR")} km` : "",
      car.city,
      discount >= 0.05 ? `piyasanın %${Math.round(discount * 100)} altı` : "",
    ]
      .filter(Boolean)
      .join(" • "),
  }));
  return { cards, total };
}
