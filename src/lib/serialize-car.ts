import { Car } from "@/types";
import { MarketSegmentStats, segmentKey } from "@/lib/market-price";
import { enrichFeatures } from "@/lib/derive-specs";

export type LeanCarDoc = {
  _id: { toString(): string };
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  city: string;
  address?: string;
  description: string;
  imageUrl: string;
  images?: string[];
  damageFlag?: boolean;
  location?: { lat: number; lng: number };
  features: Car["features"];
  source: string;
  sourceSite?: Car["sourceSite"];
  listingUrl?: string;
  externalId?: string;
  listingDate?: string;
  sellerType?: string;
  paintChange?: string;
  ownerId?: { toString(): string } | null;
  moderationStatus?: "approved" | "pending" | "rejected";
  rejectionReason?: string;
  status?: "active" | "sold" | "removed";
  viewCount?: number;
  contactPhone?: string;
  minOffer?: number;
  damageParts?: { name: string; state: string }[];
  businessName?: string;
  priceHistory?: Array<{ price: number; recordedAt: Date | string }>;
  createdAt?: Date;
  updatedAt?: Date;
};

export function serializeCar(
  doc: LeanCarDoc,
  market?: MarketSegmentStats
): Car {
  const marketAvgPrice = market?.avgPrice;
  const marketListingCount = market?.listingCount;
  const priceVsMarket =
    marketAvgPrice !== undefined ? doc.price - marketAvgPrice : undefined;

  return {
    _id: doc._id.toString(),
    title: doc.title,
    brand: doc.brand,
    model: doc.model,
    year: doc.year,
    price: doc.price,
    mileage: doc.mileage,
    city: doc.city,
    address: doc.address || "",
    description: doc.description,
    imageUrl: doc.imageUrl,
    images: doc.images || [],
    damageFlag: doc.damageFlag || false,
    location: doc.location,
  
    features: enrichFeatures(doc.features, doc.title, doc.description),
    source: doc.source,
    sourceSite: doc.sourceSite || "demo",
    listingUrl: doc.listingUrl || "",
    externalId: doc.externalId || "",
    listingDate: doc.listingDate || "",
    sellerType: doc.sellerType || "",
    paintChange: doc.paintChange || "",
    damageParts: doc.damageParts || [],
    ownerId: doc.ownerId ? doc.ownerId.toString() : undefined,
    moderationStatus: doc.moderationStatus,
    rejectionReason: doc.rejectionReason || "",
    status: doc.status || "active",
    viewCount: doc.viewCount || 0,
    contactPhone: doc.contactPhone || "",
    minOffer: doc.minOffer || 0,
    businessName: doc.businessName || "",
    marketAvgPrice,
    marketListingCount,
    priceVsMarket,
    createdAt: doc.createdAt?.toISOString?.() || "",
    updatedAt: doc.updatedAt?.toISOString?.() || "",
    priceHistory: (doc.priceHistory || []).map((point) => ({
      price: point.price,
      recordedAt:
        point.recordedAt instanceof Date
          ? point.recordedAt.toISOString()
          : String(point.recordedAt),
    })),
  };
}


export const LIST_IMAGE_LIMIT = 8;


export function serializeCarForList(
  doc: LeanCarDoc,
  market?: MarketSegmentStats
): Car {
  const car = serializeCar(doc, market);
  return {
    ...car,
    description: "",
    images: (car.images || []).slice(0, LIST_IMAGE_LIMIT),
  };
}

export function attachMarketToCars(
  docs: LeanCarDoc[],
  marketMap: Map<string, MarketSegmentStats>,

  options: { forList?: boolean } = {}
) {
  const { forList = true } = options;
  return docs.map((doc) => {
    const market = marketMap.get(segmentKey(doc.brand, doc.model, doc.year));
    return forList ? serializeCarForList(doc, market) : serializeCar(doc, market);
  });
}

export function isLeanCarDoc(value: unknown): value is LeanCarDoc {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "_id" in value &&
    "title" in value
  );
}
