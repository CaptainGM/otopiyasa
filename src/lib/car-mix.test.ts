import { describe, expect, it } from "vitest";
import { isMixedSort, mixedSortStages, dailyMixSeed } from "./car-mix";

describe("isMixedSort", () => {
  it("varsayılan (sıralama seçilmemiş) karışıktır", () => {
    expect(isMixedSort(undefined)).toBe(true);
    expect(isMixedSort("")).toBe(true);
    expect(isMixedSort("mixed")).toBe(true);
  });

  it("açık sıralama seçildiğinde karıştırma devre dışı", () => {
    for (const sort of ["newest", "price_asc", "price_desc", "year_desc"]) {
      expect(isMixedSort(sort)).toBe(false);
    }
  });
});

describe("dailyMixSeed", () => {
  it("aynı gün sabit, farklı gün değişir (sayfalama tutarlılığı)", () => {
    const t = 1_800_000_000_000; 
    expect(dailyMixSeed(t)).toBe(dailyMixSeed(t + 1000)); 
    expect(dailyMixSeed(t)).not.toBe(dailyMixSeed(t + 86_400_000)); 
  });
});

describe("mixedSortStages", () => {
  const stages = mixedSortStages();

  it("tohum mixKey hesabına girer (dizilim günden güne tazelensin)", () => {
    const withSeed = JSON.stringify(mixedSortStages(12345));
    const noSeed = JSON.stringify(mixedSortStages(0));
    expect(withSeed).toContain("12345");
    expect(withSeed).not.toBe(noSeed);
  });

  it("marka+model segmentine göre bölümler", () => {
    const win = stages[0] as { $setWindowFields: { partitionBy: unknown } };
    expect(JSON.stringify(win.$setWindowFields.partitionBy)).toContain("$brand");
    expect(JSON.stringify(win.$setWindowFields.partitionBy)).toContain("$model");
  });

  it("$documentNumber TEK alanlı sortBy ile kullanılır", () => {
    
    const win = stages[0] as { $setWindowFields: { sortBy: Record<string, number> } };
    expect(Object.keys(win.$setWindowFields.sortBy)).toHaveLength(1);
  });

  it("sıralama önce segment sırası, sonra dağıtıcı anahtar", () => {
    const sortStage = stages.find((s) => "$sort" in s) as { $sort: Record<string, number> };
    const keys = Object.keys(sortStage.$sort);
    expect(keys[0]).toBe("segmentRank");
    expect(keys).toContain("mixKey");
    
    expect(keys[keys.length - 1]).toBe("_id");
  });

  it("yardımcı alanlar sonuçtan temizlenir", () => {
    const unset = stages.find((s) => "$unset" in s) as { $unset: string[] };
    expect(unset.$unset).toEqual(expect.arrayContaining(["segmentRank", "mixKey"]));
  });

  it("rastgelelik kullanmaz — sayfalama tutarlı olmalı", () => {
    
    const json = JSON.stringify(stages);
    expect(json).not.toContain("$sample");
    expect(json).not.toContain("$rand");
  });
});
