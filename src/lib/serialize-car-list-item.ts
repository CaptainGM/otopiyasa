import { Car, CarListItem } from "@/types";
import { withPendingLabels } from "@/lib/scraper/feature-merge";

/** Strip fields the listing row never renders before sending it to a client. */
type CarListSource = Pick<Car, "title" | "year" | "price" | "mileage" | "city"> & {
  _id: string | { toString(): string };
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
  verifiedFeatures?: string[];
  featuresVerifiedAt?: Date | string;
};

export const CARD_PHOTO_LIMIT = 6;

export function serializeCarListItem(car: CarListSource): CarListItem {
  return {
    _id: car._id.toString(),
    title: car.title,
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
        transmission: car.features?.transmission ?? "Belirtilmemiş",
      },
      car
    ),
    priceHistory: (car.priceHistory ?? []).slice(-2).map((point) => ({
      price: point.price,
      recordedAt: point.recordedAt.toString(),
    })),
    marketAvgPrice: car.marketAvgPrice,
    marketListingCount: car.marketListingCount,
  };
}
