import { describe, expect, it } from "vitest";
import { Car } from "@/types";
import { serializeCarListItem } from "@/lib/serialize-car-list-item";

describe("serializeCarListItem", () => {
  it("keeps only card data and bounds gallery/history payloads", () => {
    const car = {
      _id: "listing-1",
      title: "Toyota Corolla 1.6",
      year: 2020,
      price: 1_000_000,
      mileage: 40_000,
      city: "İstanbul",
      imageUrl: "https://images.unsplash.com/car.jpg",
      images: ["one", "two", "three", "four", "five"],
      description: "large description should not be sent",
      features: { fuelType: "Benzin", transmission: "Otomatik", bodyType: "Sedan", color: "Beyaz" },
      sourceSite: "arabam",
      priceHistory: [1, 2, 3].map((price) => ({ price, recordedAt: "2026-01-01" })),
    } as unknown as Car;

    const item = serializeCarListItem(car);
    expect(item.images).toHaveLength(4);
    expect(item.priceHistory.map((point) => point.price)).toEqual([2, 3]);
    expect(item.features).toEqual({ fuelType: "Benzin", transmission: "Otomatik" });
    expect(item).not.toHaveProperty("description");
    expect(item).not.toHaveProperty("brand");
  });
});
