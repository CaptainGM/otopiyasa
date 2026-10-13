import { beforeEach, describe, expect, it, vi } from "vitest";

const finds: Array<Record<string, unknown>> = [];
const batches: unknown[][] = [];
const written: Array<Record<string, any>> = [];

vi.mock("@/models/Car", () => ({
  Car: {
    find: (filter: Record<string, unknown>) => {
      finds.push(filter);
      const chain = {
        select: () => chain,
        limit: () => chain,
        lean: async () => batches.shift() ?? [],
      };
      return chain;
    },
    bulkWrite: async (ops: Array<Record<string, any>>) => {
      written.push(...ops);
    },
  },
}));

const predictPrice = vi.fn();
vi.mock("@/lib/price-prediction", () => ({
  derivePainted: () => 0,
  predictPrice: (...args: unknown[]) => predictPrice(...args),
  withPredictionMemo: (fn: () => unknown) => fn(),
}));

import { FAIR_LOGIC_VERSION, refreshFairValues } from "./market-fair";

const car = (id: string, price = 1_000_000) => ({ _id: id, brand: "Chery", model: "Tiggo 7 Pro", year: 2023, mileage: 40_000, price, title: "Chery Tiggo 7 Pro", features: null });

beforeEach(() => {
  finds.length = 0;
  batches.length = 0;
  written.length = 0;
  predictPrice.mockReset();
});

describe("refreshFairValues", () => {
  it("önce eski mantıkla emsalsiz diye temizlenmiş ilanları, sonra diğerlerini sorgular", async () => {
    batches.push([car("a")], [car("b")]);
    predictPrice.mockResolvedValue({ predictedPrice: 1_100_000, sampleSize: 40 });
    const result = await refreshFairValues(100);
    expect(result).toMatchObject({ scanned: 2, updated: 2, cleared: 0, failed: 0 });
    expect(finds).toHaveLength(2);
    expect(finds[0]).toMatchObject({ "market.fairAt": { $exists: true }, "market.fair": { $exists: false }, "market.fairV": { $ne: FAIR_LOGIC_VERSION } });
    // İkinci sorgu, birincide gelenleri dışarıda bırakır ve sürüm farkını da ister.
    expect(finds[1]._id).toEqual({ $nin: ["a"] });
    expect(JSON.stringify(finds[1].$or)).toContain("market.fairV");
  });

  it("temizlenmişler limiti doldurursa ikinci sorgu çalışmaz", async () => {
    batches.push([car("a"), car("b")]);
    predictPrice.mockResolvedValue({ predictedPrice: 1_100_000, sampleSize: 40 });
    await refreshFairValues(2);
    expect(finds).toHaveLength(1);
  });

  it("hesaplanan ilana mantık sürümü yazılır", async () => {
    batches.push([car("a")], []);
    predictPrice.mockResolvedValue({ predictedPrice: 1_100_000, sampleSize: 40 });
    await refreshFairValues(100);
    expect(written[0].updateOne.update.$set["market.fairV"]).toBe(FAIR_LOGIC_VERSION);
    expect(written[0].updateOne.update.$set["market.fair"]).toBe(1_100_000);
  });

  it("gerçekten emsalsiz ilan temizlenir ve sürüm yazılır (tekrar tekrar denenmez)", async () => {
    batches.push([car("a")], []);
    predictPrice.mockResolvedValue({ predictedPrice: 900_000, sampleSize: 1 });
    const result = await refreshFairValues(100);
    expect(result).toMatchObject({ updated: 0, cleared: 1, failed: 0 });
    const update = written[0].updateOne.update;
    expect(update.$set["market.fairV"]).toBe(FAIR_LOGIC_VERSION);
    expect(update.$unset["market.fair"]).toBe(1);
  });

  it("geçici hata ilanı temizlemez: dokunulmaz ve hata olarak sayılır", async () => {
    batches.push([car("a"), car("b")], []);
    predictPrice.mockRejectedValueOnce(new Error("bağlantı koptu")).mockResolvedValueOnce({ predictedPrice: 1_100_000, sampleSize: 40 });
    const result = await refreshFairValues(100);
    expect(result).toMatchObject({ scanned: 2, updated: 1, cleared: 0, failed: 1 });
    expect(written).toHaveLength(1);
    expect(written[0].updateOne.filter._id).toBe("b");
  });
});
