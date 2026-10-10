import { resolvePlacement } from "@/lib/district-coords";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { brandStorageAliases } from "@/lib/normalize-brand";
import { cityStorageAliases } from "@/lib/normalize-city";
import { TR_GEO } from "@/lib/tr-geo";
import { normalizeFuelType } from "@/lib/normalize-fuel";
import { modelFamilyRegex } from "@/lib/model-family";



export interface ClusterInput {
  city: string;
  address?: string;
  price: number;
 
  description?: string;
}

export interface MapCluster {
  
  key: string;
  city: string;
  
  district: string;
  /** İlçenin Türkçe yazılışı ("cerkezkoy" → "Çerkezköy"); il geneli kümelerde boş. */
  districtLabel: string;
  lat: number;
  lng: number;
  count: number;
  minPrice: number;
  
  level: "district" | "province";
}


export function clusterKeyFor(car: ClusterInput): {
  key: string;
  lat: number;
  lng: number;
  district: string;
  level: "district" | "province";
} | null {
  
  const placed = resolvePlacement(car.city || "", car.address, 0, car.description);
  if (!placed) return null;

  const district = placed.level === "district" ? placed.district || "" : "";
  return {
    key: `${car.city}|${district}`,
    lat: placed.lat,
    lng: placed.lng,
    district,
    level: placed.level,
  };
}

export function buildClusters(cars: ClusterInput[]): {
  clusters: MapCluster[];
  total: number;
  unmapped: number;
} {
  const map = new Map<string, MapCluster>();
  let unmapped = 0;

  for (const car of cars) {
    const placed = clusterKeyFor(car);
    if (!placed) {
      unmapped += 1;
      continue;
    }
    const existing = map.get(placed.key);
    if (existing) {
      existing.count += 1;
      if (car.price > 0 && car.price < existing.minPrice) existing.minPrice = car.price;
    } else {
      map.set(placed.key, {
        key: placed.key,
        city: car.city,
        district: placed.district,
        districtLabel: placed.district ? prettyDistrict(placed.district) : "",
        lat: placed.lat,
        lng: placed.lng,
        count: 1,
        minPrice: car.price > 0 ? car.price : Infinity,
        level: placed.level,
      });
    }
  }

  const clusters = [...map.values()].map((c) => ({
    ...c,
    minPrice: Number.isFinite(c.minPrice) ? c.minPrice : 0,
  }));
  
  clusters.sort((a, b) => b.count - a.count);

  return { clusters, total: cars.length - unmapped, unmapped };
}


export function buildMapQuery(params: URLSearchParams): Record<string, unknown> {

  const query: Record<string, unknown> = { ...PUBLIC_LISTING_FILTER };

  const brand = params.get("brand");
  if (brand) query.brand = { $in: brandStorageAliases(brand) };

  // Ana listedeki filtreyle aynı: model ailesiyle eşleşir (marka seçiliyken).
  const model = params.get("model");
  if (model) query.model = modelFamilyRegex(model, brand);

  const city = params.get("city");
  if (city) query.city = { $in: cityStorageAliases(city) };

  const fuel = params.get("fuel");
  if (fuel) query["features.fuelType"] = normalizeFuelType(fuel);

  const min = Number(params.get("minPrice"));
  const max = Number(params.get("maxPrice"));
  const price: Record<string, number> = {};
  if (Number.isFinite(min) && min > 0) price.$gte = min;
  if (Number.isFinite(max) && max > 0) price.$lte = max;
  if (Object.keys(price).length > 0) query.price = price;

  const discountOnly = params.get("discountOnly") === "true";
  if (discountOnly) {
    (query as Record<string, unknown[]>).$and = [
      ...((query as Record<string, unknown[]>).$and || []),
      {
        $expr: {
          $and: [
            { $gt: [{ $size: { $ifNull: ["$priceHistory", []] } }, 1] },
            { $gt: [{ $arrayElemAt: ["$priceHistory.price", 0] }, "$price"] },
          ],
        },
      },
    ];
  }

  if (params.get("excludeOutliers") === "true") query["market.outlier"] = { $ne: true };

  return query;
}


const foldName = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z0-9]/g, "");

let displayNames: Map<string, string> | null = null;

/**
 * Koordinat tablosu ilçeleri sade anahtarla tutuyor ("cerkezkoy"); görünen ad il/ilçe listesindeki
 * Türkçe yazılıştan alınır, listede yoksa kelimelerin baş harfi büyütülür.
 */
export function prettyDistrict(name: string): string {
  if (!displayNames) {
    displayNames = new Map();
    for (const list of Object.values(TR_GEO)) {
      for (const district of list) {
        const key = foldName(district);
        if (!displayNames.has(key)) displayNames.set(key, district);
      }
    }
  }
  const known = displayNames.get(foldName(name));
  if (known) return known;
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1))
    .join(" ");
}

const EARTH_RADIUS_KM = 6371;


export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
