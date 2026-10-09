import { Car, CarListItem } from "@/types";
import { displayTransmission } from "@/lib/transmission-label";
import { withPendingLabels } from "@/lib/scraper/feature-merge";

/** Strip fields the listing row never renders before sending it to a client. */
type CarListSource = Pick<Car, "title" | "year" | "price" | "mileage" | "city"> & {
  _id: string | { toString(): string };
  brand?: string;
  model?: string;
  imageUrl?: string;
  images?: string[];
  damageFlag?: boolean;
  sourceSite?: Car["sourceSite"];
  status?: Car["status"];
  listingDate?: string;
  features?: Partial<Car["features"]>;
  priceHistory?: Array<{ price: number; recordedAt: string | Date }>;
  marketAvgPrice?: number;
  marketListingCount?: number;
  fairPrice?: number;
  fairSample?: number;
  /** Saatlik piyasa anlık görüntüsü (bkz. lib/market-snapshot.ts); kart göstergesi için. */
  market?: { avg?: number; count?: number; fair?: number; fairN?: number } | null;
  verifiedFeatures?: string[];
  featuresVerifiedAt?: Date | string;
};

export const CARD_PHOTO_LIMIT = 6;

export function serializeCarListItem(car: CarListSource): CarListItem {
  return {
    _id: car._id.toString(),
    title: car.title,
    brand: car.brand,
    model: car.model,
    year: car.year,
    price: car.price,
    mileage: car.mileage,
    city: car.city,
    imageUrl: car.imageUrl ?? "",
    // Kartta gezdirilecek fotoğraf sayısı; liste yükünü şişirmemek için sınırlı.
    images: (car.images ?? []).filter(Boolean).slice(0, CARD_PHOTO_LIMIT),
    damageFlag: car.damageFlag,
    sourceSite: car.sourceSite ?? "demo",
    status: car.status ?? "active",
    listingDate: car.listingDate,
    features: withPendingLabels(
      {
        fuelType: car.features?.fuelType ?? "Belirtilmemiş",
        transmission: displayTransmission(car.features?.transmission ?? "Belirtilmemiş"),
      },
      car
    ),
    priceHistory: (car.priceHistory ?? []).slice(-2).map((point) => ({
      price: point.price,
      recordedAt: point.recordedAt.toString(),
    })),
    fairPrice: car.fairPrice ?? car.market?.fair,
    fairSample: car.fairSample ?? car.market?.fairN,
    marketAvgPrice: car.marketAvgPrice ?? car.market?.avg,
    marketListingCount: car.marketListingCount ?? car.market?.count,
  };
}
