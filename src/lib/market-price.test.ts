import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { aggregate } = vi.hoisted(() => ({ aggregate: vi.fn() }));
vi.mock("@/models/Car", () => ({ Car: { aggregate } }));

import { getMarketMap, MIN_MARKET_SAMPLE, summarizeMarketPrices } from "./market-price";

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
    });
  });
});

beforeEach(() => {
  aggregate.mockReset();
});
