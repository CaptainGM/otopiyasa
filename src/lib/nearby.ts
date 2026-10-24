import { Car } from "@/models/Car";
import { cached, CACHE_TTL } from "@/lib/cache";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { buildClusters, clusterKeyFor, distanceKm, prettyDistrict, type ClusterInput, type MapCluster } from "@/lib/map-clusters";
import { LIST_IMAGE_LIMIT } from "@/lib/serialize-car";

/** Haritanın varsayılan kümeleri; harita ve "yakınımdaki ilanlar" aynı önbelleği paylaşır. */
export function getDefaultMapClusters() {
  return cached("map:default_clusters:v3", CACHE_TTL.long, async () => {
    const rows = await Car.aggregate<{
      _id: { city?: string; address?: string };
      count: number;
      minPrice: number;
    }>([
      { $match: PUBLIC_LISTING_FILTER },
      {
        $group: {
          _id: { city: "$city", address: "$address" },
          count: { $sum: 1 },
          minPrice: { $min: "$price" },
        },
      },
    ]);
    const input: ClusterInput[] = rows.map((r) => ({
      city: r._id.city || "",
      address: r._id.address,
      price: r.minPrice || 0,
      count: r.count,
    }));
    return buildClusters(input);
  });
}

export interface NearbyCluster {
  cluster: MapCluster;
  distanceKm: number;
}

/**
 * Konuma en yakın kümeleri seçer: istenen ilan sayısına ulaşana kadar yakından uzağa.
 * Eskiden her istekte tüm aktif ilanlar (~28 bin) çekilip tek tek konumlandırılıyordu (~2 sn).
 */
export function pickNearestClusters(
  clusters: MapCluster[],
  point: { lat: number; lng: number },
  wanted: number,
  maxClusters = 8
): NearbyCluster[] {
  const sorted = clusters
    .map((cluster) => ({ cluster, distanceKm: distanceKm(point, cluster) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const picked: NearbyCluster[] = [];
  let total = 0;
  for (const item of sorted) {
    if (picked.length >= maxClusters || (total >= wanted && picked.length > 0)) break;
    picked.push(item);
    total += item.cluster.count;
  }
  return picked;
}

export interface NearbyItem {
  _id: string;
  title: string;
  year: number;
  city: string;
  district: string;
  price: number;
  mileage: number;
  imageUrl: string;
  images: string[];
  distanceKm: number;
  approximate: boolean;
}

/**
 * En yakın ilanlar. Aynı ilçedeki ilanların mesafesi eşit olduğundan (konum ilçe merkezinden
 * hesaplanıyor) eşitlikte en yeni ilanlar öne alınır; eskiden sıra rastgele kalıyor, başa
 * 30 yıllık araçlar düşebiliyordu.
 */
export async function findNearbyListings(point: { lat: number; lng: number }, limit: number): Promise<NearbyItem[]> {
  const { clusters } = await getDefaultMapClusters();
  const picked = pickNearestClusters(clusters, point, limit);
  if (picked.length === 0) return [];

  const byKey = new Map(picked.map((p) => [p.cluster.key, p]));
  const cities = [...new Set(picked.map((p) => p.cluster.city))];

  // 1. adım: yalnızca konum alanları (küme anahtarı haritayla aynı alanlardan hesaplanmalı).
  const light = (await Car.find({ ...PUBLIC_LISTING_FILTER, city: { $in: cities } }, { city: 1, address: 1, createdAt: 1 })
    .lean()) as unknown as Array<{ _id: unknown; city: string; address?: string; createdAt?: Date }>;

  const ranked = light
    .map((car) => {
      const placed = clusterKeyFor({ city: car.city, address: car.address, price: 0 });
      const hit = placed ? byKey.get(placed.key) : undefined;
      return hit ? { id: car._id, hit, created: car.createdAt ? new Date(car.createdAt).getTime() : 0 } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.hit.distanceKm - b.hit.distanceKm || b.created - a.created)
    .slice(0, limit);

  // 2. adım: yalnızca gösterilecek ilanların ayrıntısı.
  const docs = (await Car.find({ _id: { $in: ranked.map((r) => r.id) } })
    .select("title year city price mileage imageUrl images")
    .slice("images", LIST_IMAGE_LIMIT)
    .lean()) as unknown as Array<{ _id: unknown; title: string; year: number; city: string; price: number; mileage: number; imageUrl: string; images?: string[] }>;
  const docById = new Map(docs.map((d) => [String(d._id), d]));

  return ranked
    .map((r) => {
      const d = docById.get(String(r.id));
      if (!d) return null;
      const c = r.hit.cluster;
      return {
        _id: String(d._id),
        title: d.title,
        year: d.year,
        city: d.city,
        district: c.district ? prettyDistrict(c.district) : "",
        price: d.price,
        mileage: d.mileage,
        imageUrl: d.imageUrl,
        images: d.images || [],
        distanceKm: Math.round(r.hit.distanceKm * 10) / 10,
        approximate: c.level === "province",
      };
    })
    .filter((x): x is NearbyItem => x !== null);
}

/**
 * Mobil "yakınımdaki ilanlar": verilen yarıçap içindeki TÜM ilanlar, sayfa sayfa ve isteğe bağlı
 * araç sınıfı ile sıralama filtresiyle. Eski sürüm en yakın N ilanı alıyordu; kullanıcı yarıçapın
 * dışındaki ilanlara da düşüyordu ve listenin sonu yoktu.
 */
export const NEARBY_SORTS = ["distance", "priceAsc", "priceDesc"] as const;
export type NearbySort = (typeof NEARBY_SORTS)[number];
export const NEARBY_VEHICLE_CLASSES = ["otomobil", "suv-pickup", "minivan-panelvan", "ticari"] as const;
export type NearbyVehicleClass = (typeof NEARBY_VEHICLE_CLASSES)[number];

/** Yarıçap içindeki bir ilanın sıralamada kullanılan özeti. Gövde (başlık, fotoğraf) yalnızca gösterilen sayfa için okunur. */
export interface NearbyCandidate {
  id: string;
  distanceKm: number;
  approximate: boolean;
  district: string;
  price: number;
  created: number;
}

/** Saf sıralama: mesafe ya da fiyat; eşitlikte en yeni ilan öne (aynı kural eski sürümde de vardı). */
export function rankNearbyCandidates(candidates: NearbyCandidate[], sort: NearbySort): NearbyCandidate[] {
  const byDistance = (a: NearbyCandidate, b: NearbyCandidate) => a.distanceKm - b.distanceKm || b.created - a.created;
  if (sort === "priceAsc") return [...candidates].sort((a, b) => a.price - b.price || byDistance(a, b));
  if (sort === "priceDesc") return [...candidates].sort((a, b) => b.price - a.price || byDistance(a, b));
  return [...candidates].sort(byDistance);
}

/** Sayfa dilimi (sayfa numarası 1'den başlar). */
export function pageSlice<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number; hasMore: boolean } {
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, hasMore: start + pageSize < items.length };
}

/**
 * Yarıçap içindeki ilan adayları. Koordinat yaklaşık olduğundan (ilçe merkezi) 110 m'lik hücreye
 * yuvarlanır; aynı hücredeki kullanıcılar aynı listeyi paylaşır ve sonsuz kaydırmada her sayfada
 * sorgu tekrarlanmaz.
 */
function nearbyCandidates(point: { lat: number; lng: number }, radiusKm: number, vehicleClass?: NearbyVehicleClass) {
  const key = `nearby:${point.lat.toFixed(3)}:${point.lng.toFixed(3)}:${radiusKm}:${vehicleClass ?? "all"}`;
  return cached(key, CACHE_TTL.medium, async (): Promise<NearbyPool> => {
    const { clusters } = await getDefaultMapClusters();
    const inRadius = clusters
      .map((cluster) => ({ cluster, distanceKm: distanceKm(point, cluster) }))
      .filter((item) => item.distanceKm <= radiusKm);
    if (inRadius.length === 0) return { candidates: [], withoutDistrict: 0 };

    const byKey = new Map(inRadius.map((p) => [p.cluster.key, p]));
    const cities = [...new Set(inRadius.map((p) => p.cluster.city))];
    const filter = {
      ...PUBLIC_LISTING_FILTER,
      city: { $in: cities },
      ...(vehicleClass ? { vehicleClass } : {}),
    };
    const light = (await Car.find(filter, { city: 1, address: 1, createdAt: 1, price: 1 }).lean()) as unknown as Array<{
      _id: unknown;
      city: string;
      address?: string;
      price: number;
      createdAt?: Date;
    }>;

    const pool: NearbyPool = { candidates: [], withoutDistrict: 0 };
    for (const car of light) {
      const placed = clusterKeyFor({ city: car.city, address: car.address, price: 0 });
      const hit = placed ? byKey.get(placed.key) : undefined;
      if (!hit) continue;
      // İlçesi bilinmeyen ilanın "mesafesi" il merkezine göredir. Bu bir yakınlık bilgisi değil; 10 km sonucuna
      // alınırsa İstanbul'un tamamı merkezde "0 km" görünür. Bu yüzden sayılır ama listelenmez.
      if (hit.cluster.level === "province") {
        pool.withoutDistrict += 1;
        continue;
      }
      pool.candidates.push({
        id: String(car._id),
        distanceKm: hit.distanceKm,
        approximate: false,
        district: hit.cluster.district ? prettyDistrict(hit.cluster.district) : "",
        price: car.price,
        created: car.createdAt ? new Date(car.createdAt).getTime() : 0,
      });
    }
    return pool;
  });
}

/** Yarıçap havuzu: mesafesi güvenilir ilanlar ve mesafesi hesaplanamayan (ilçesiz) ilan sayısı. */
interface NearbyPool {
  candidates: NearbyCandidate[];
  withoutDistrict: number;
}

export interface NearbyPageOptions {
  radiusKm: number;
  page: number;
  pageSize: number;
  sort: NearbySort;
  vehicleClass?: NearbyVehicleClass;
}

export async function findNearbyPage(
  point: { lat: number; lng: number },
  options: NearbyPageOptions
): Promise<{ items: NearbyItem[]; total: number; hasMore: boolean; withoutDistrict: number }> {
  const pool = await nearbyCandidates(point, options.radiusKm, options.vehicleClass);
  const slice = pageSlice(rankNearbyCandidates(pool.candidates, options.sort), options.page, options.pageSize);
  if (slice.items.length === 0) return { items: [], total: slice.total, hasMore: false, withoutDistrict: pool.withoutDistrict };

  const docs = (await Car.find({ _id: { $in: slice.items.map((c) => c.id) } })
    .select("title year city price mileage imageUrl images")
    .slice("images", LIST_IMAGE_LIMIT)
    .lean()) as unknown as Array<{ _id: unknown; title: string; year: number; city: string; price: number; mileage: number; imageUrl: string; images?: string[] }>;
  const docById = new Map(docs.map((d) => [String(d._id), d]));

  const items = slice.items.flatMap((c): NearbyItem[] => {
    const d = docById.get(c.id);
    if (!d) return [];
    return [
      {
        _id: String(d._id),
        title: d.title,
        year: d.year,
        city: d.city,
        district: c.district,
        price: d.price,
        mileage: d.mileage,
        imageUrl: d.imageUrl,
        images: d.images || [],
        distanceKm: Math.round(c.distanceKm * 10) / 10,
        approximate: c.approximate,
      },
    ];
  });
  return { items, total: slice.total, hasMore: slice.hasMore, withoutDistrict: pool.withoutDistrict };
}
