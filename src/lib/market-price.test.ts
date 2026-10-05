import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { aggregate } = vi.hoisted(() => ({ aggregate: vi.fn() }));
vi.mock("@/models/Car", () => ({ Car: { aggregate } }));

import { getMarketMap, MIN_MARKET_SAMPLE, selectSparseMarketSegments, summarizeMarketPrices } from "./market-price";

describe("piyasa ortalaması örnek sayısı", () => {
  it("tek ya da iki ilanı piyasa ortalaması diye göstermez", () => {
    expect(summarizeMarketPrices([1_000_000])).toEqual({ avgPrice: 0, listingCount: 1 });
    expect(summarizeMarketPrices([1_000_000, 1_200_000])).toEqual({ avgPrice: 0, listingCount: 2 });
  });

  it("en az üç geçerli emsal varsa kırpılmış ortalamayı verir", () => {
    expect(MIN_MARKET_SAMPLE).toBe(3);
    expect(summarizeMarketPrices([900_000, 1_000_000, 1_100_000])).toEqual({
      avgPrice: 1_000_000,
      listingCount: 3,
    });
  });

  it("geçersiz fiyatları örnek sayısına katmaz", () => {
    expect(summarizeMarketPrices([0, 900_000, 1_000_000, 1_100_000])).toEqual({
      avgPrice: 1_000_000,
      listingCount: 3,
    });
  });

  it("aykırı fiyatlardan sonra iki emsal kalıyorsa ortalama vermez ve segmenti taramaya alır", () => {
    const prices = [1_000_000, 1_100_000, 20_000_000];
    expect(summarizeMarketPrices(prices)).toEqual({ avgPrice: 0, listingCount: 2 });
    expect(selectSparseMarketSegments([
      { brand: "Mazda", model: "B2500", year: 1998, prices },
      { brand: "Honda", model: "CR-V", year: 2011, prices: [900_000, 1_000_000, 1_100_000, 20_000_000] },
    ])).toEqual([
      { brand: "Mazda", model: "B2500", familyKey: "b2500", year: 1998, hiddenListings: 3, listingCount: 2 },
    ]);
  });

  it("seyrek segmentleri model ailesi + yıl olarak birleştirir", () => {
    const result = selectSparseMarketSegments([
      { brand: "Toyota", model: "Corolla 1.6 Vision", year: 2015, prices: [700_000] },
      { brand: "Toyota", model: "COROLLA", year: 2015, prices: [720_000] },
      { brand: "Toyota", model: "Corolla 1.4 D-4D", year: 2015, prices: [690_000] },
      { brand: "Nissan", model: "Juke 1.0 DIG-T Platinum", year: 2021, prices: [1_100_000] },
    ]);
    // Corolla 2015 ailesinde 3 emsal var: ortalaması gösterilir, taranmaz.
    expect(result).toEqual([
      { brand: "Nissan", model: "Juke", familyKey: "juke", year: 2021, hiddenListings: 1, listingCount: 1 },
    ]);
  });

  it("karşılaştırılan ilanları piyasa örnekleminden çıkarır", async () => {
    const excluded = new Types.ObjectId();
    aggregate.mockResolvedValueOnce([
      {
        _id: { brand: "Toyota", model: "Corolla", year: 2020 },
        prices: [900_000, 1_000_000, 1_100_000],
        listingCount: 3,
      },
    ]);

    const result = await getMarketMap(
      [{ brand: "Toyota", model: "Corolla", year: 2020 }],
      [excluded]
    );

    expect(aggregate).toHaveBeenCalledOnce();
    expect(aggregate.mock.calls[0][0][0].$match._id.$nin).toEqual([excluded]);
    expect(result.get("Toyota::Corolla::2020")).toMatchObject({
      avgPrice: 1_000_000,
      listingCount: 3,
      scope: "model",
    });
  });

  it("donanımda üç emsal yoksa aynı yılın aile ortalamasına düşer", async () => {
    aggregate.mockResolvedValueOnce([
      { _id: { brand: "Toyota", model: "Corolla 1.6 Vision", year: 2015 }, prices: [700_000], listingCount: 1 },
      { _id: { brand: "Toyota", model: "COROLLA", year: 2015 }, prices: [720_000, 740_000], listingCount: 2 },
      { _id: { brand: "Toyota", model: "Auris 1.6", year: 2015 }, prices: [5_000_000], listingCount: 1 },
    ]);

    const result = await getMarketMap([{ brand: "Toyota", model: "Corolla 1.6 Vision", year: 2015 }], [new Types.ObjectId()]);

    expect(aggregate.mock.calls[0][0][0].$match.$or).toEqual([{ brand: "Toyota", year: 2015 }]);
    expect(result.get("Toyota::Corolla 1.6 Vision::2015")).toMatchObject({
      avgPrice: 720_000,
      listingCount: 3,
      scope: "family",
      familyLabel: "Corolla",
    });
  });

  it("aile de yetmiyorsa ortalama vermez", async () => {
    aggregate.mockResolvedValueOnce([
      { _id: { brand: "Mazda", model: "B2500", year: 1998 }, prices: [400_000, 420_000], listingCount: 2 },
    ]);
    const result = await getMarketMap([{ brand: "Mazda", model: "B2500", year: 1998 }], [new Types.ObjectId()]);
    expect(result.get("Mazda::B2500::1998")).toMatchObject({ avgPrice: 0, listingCount: 2 });
  });
});

beforeEach(() => {
  aggregate.mockReset();
});
