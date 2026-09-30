import { describe, expect, it } from "vitest";
import { isSellableQuality, pickDeals } from "./deals";
import type { Car } from "@/types";

function car(over: Partial<Car>): Car {
  return {
    _id: Math.random().toString(36).slice(2),
    title: "Test",
    brand: "VW",
    model: "Golf",
    year: 2018,
    price: 800_000,
    mileage: 80_000,
    city: "İstanbul",
    description: "",
    imageUrl: "",
    images: [],
    damageFlag: false,
    features: { fuelType: "Benzin", transmission: "Otomatik", bodyType: "Hatchback", color: "Gri" },
    source: "demo",
    sourceSite: "demo",
    priceHistory: [],
    createdAt: "",
    updatedAt: "",
    marketAvgPrice: 1_000_000,
    marketListingCount: 5,
    ...over,
  } as Car;
}

describe("isSellableQuality", () => {
  it("eski Tofaş'ı eler (kullanıcının şikayeti)", () => {
    expect(isSellableQuality(car({ year: 2005, mileage: 250_000, price: 250_000 }))).toBe(false);
  });
  it("yüksek km'yi eler", () => {
    expect(isSellableQuality(car({ mileage: 200_000 }))).toBe(false);
  });
  it("hasarlıyı eler", () => {
    expect(isSellableQuality(car({ damageFlag: true }))).toBe(false);
  });
  it("2010+ düşük km hasarsızı kabul eder", () => {
    expect(isSellableQuality(car({ year: 2015, mileage: 100_000 }))).toBe(true);
  });
});

describe("pickDeals", () => {
  it("gerçekçi indirimli, satılabilir aracı fırsat sayar", () => {
    const deals = pickDeals([car({ price: 800_000, marketAvgPrice: 1_000_000, marketListingCount: 5 })]);
    expect(deals).toHaveLength(1);
    expect(deals[0].label).toContain("%20");
  });

  it("aşırı ucuz (>%45 altı) aracı ELEMEZ ama fırsat da SAYMAZ (şüpheli)", () => {
    
    const deals = pickDeals([car({ price: 400_000, marketAvgPrice: 1_000_000, marketListingCount: 5 })]);
    expect(deals).toHaveLength(0);
  });

  it("eski/yüksek km aracı indirimli olsa bile fırsat saymaz", () => {
    const deals = pickDeals([
      car({ year: 2005, mileage: 250_000, price: 200_000, marketAvgPrice: 300_000, marketListingCount: 5 }),
    ]);
    expect(deals).toHaveLength(0);
  });

  it("az emsalli (<3) aracı fırsat saymaz", () => {
    const deals = pickDeals([car({ price: 800_000, marketAvgPrice: 1_000_000, marketListingCount: 1 })]);
    expect(deals).toHaveLength(0);
  });

  it("en avantajlıyı öne sıralar ve limiti uygular", () => {
    const cars = [
      car({ price: 900_000, marketAvgPrice: 1_000_000, marketListingCount: 5 }), 
      car({ price: 820_000, marketAvgPrice: 1_000_000, marketListingCount: 5 }), 
      car({ price: 700_000, marketAvgPrice: 1_000_000, marketListingCount: 5 }), 
    ];
    const deals = pickDeals(cars, 2);
    expect(deals.length).toBeLessThanOrEqual(2);
    expect(deals[0].score).toBeGreaterThanOrEqual(deals[1]?.score ?? 0);
  });
});
