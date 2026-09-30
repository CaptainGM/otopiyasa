import { Car } from "@/models/Car";
import { cached, CACHE_TTL } from "@/lib/cache";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { buildClusters, clusterKeyFor, distanceKm, prettyDistrict, type ClusterInput, type MapCluster } from "@/lib/map-clusters";
import { LIST_IMAGE_LIMIT } from "@/lib/serialize-car";

/** Haritanın varsayılan kümeleri; harita ve "yakınımdaki ilanlar" aynı önbelleği paylaşır. */
export function getDefaultMapClusters() {
  return cached("map:default_clusters", CACHE_TTL.long, async () => {
    const cars = (await Car.find(PUBLIC_LISTING_FILTER, { _id: 0, city: 1, address: 1, price: 1 }).lean()) as unknown as ClusterInput[];
    return buildClusters(cars);
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
