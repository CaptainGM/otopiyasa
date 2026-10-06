import { describe, expect, it } from "vitest";
import { Car } from "@/types";
import { CARD_PHOTO_LIMIT, serializeCarListItem } from "@/lib/serialize-car-list-item";

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
      images: ["one", "two", "three", "four", "five", "six", "seven", "eight"],
      description: "large description should not be sent",
      features: { fuelType: "Benzin", transmission: "Otomatik", bodyType: "Sedan", color: "Beyaz" },
      sourceSite: "arabam",
      priceHistory: [1, 2, 3].map((price) => ({ price, recordedAt: "2026-01-01" })),
    } as unknown as Car;

    const item = serializeCarListItem(car);
    expect(item.images).toHaveLength(CARD_PHOTO_LIMIT);
    expect(item.images).toEqual(["one", "two", "three", "four", "five", "six"]);
    expect(item.priceHistory.map((point) => point.price)).toEqual([2, 3]);
    expect(item.features).toEqual({ fuelType: "Benzin", transmission: "Otomatik" });
    expect(item).not.toHaveProperty("description");
    expect(item).not.toHaveProperty("brand");
  });
});

describe("serializeCarListItem doğrulanmamış özellik", () => {
  it("toplu çekimden gelen ve henüz okunmamış Arabam ilanında 'Doğrulanıyor' gösterir", () => {
    const base = { _id: "x", title: "t", year: 2020, price: 1, mileage: 1, city: "İstanbul", sourceSite: "arabam" as const };
    const pending = serializeCarListItem({ ...base, features: { fuelType: "Bilinmiyor", transmission: "Bilinmiyor" } });
    expect(pending.features).toEqual({ fuelType: "Doğrulanıyor", transmission: "Doğrulanıyor" });
    // Liste sayfasından vitesi okunmuş, yakıtı sayfada yazmayan ilan
    const partly = serializeCarListItem({
      ...base,
      features: { fuelType: "Bilinmiyor", transmission: "Otomatik" },
      verifiedFeatures: ["transmission", "fuelType"],
    });
    expect(partly.features).toEqual({ fuelType: "Bilinmiyor", transmission: "Otomatik" });
  });
});
