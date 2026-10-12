import { describe, expect, it } from "vitest";
import { buildCarQuery, textSearchOptions } from "./car-query";

describe("kilometre ve satıcı filtreleri", () => {
  it("en az ve en çok kilometre aralığı yazılır", () => {
    const query = buildCarQuery({ mileageMin: 10000, mileageMax: 50000 } as any) as any;
    expect(query.mileage).toEqual({ $gte: 10000, $lte: 50000 });
  });

  it("yalnızca en çok kilometre verilirse üst sınır kalır", () => {
    const query = buildCarQuery({ mileageMax: 80000 } as any) as any;
    expect(query.mileage).toEqual({ $lte: 80000 });
  });

  it("satıcı filtresi ilan başlığının önekine bakar (Galeriden / Sahibinden)", () => {
    const query = buildCarQuery({ seller: "galeriden" } as any) as any;
    const clause = query.$and.find((c: any) => c.title)?.title?.$regex as string;
    const pattern = new RegExp(clause, "i");
    expect(pattern.test("Galeriden BMW 5 Serisi 520i M Sport 2025")).toBe(true);
    expect(pattern.test("Sahibinden BMW 5 Serisi 520i")).toBe(false);
    expect(pattern.test("BMW 5 Serisi Galeriden ile biten başlık")).toBe(false);
  });

  it("hasarsız filtresi hasar kaydını olan ilanları dışarıda bırakır", () => {
    const query = buildCarQuery({ noDamage: true } as any) as any;
    expect(query.damageFlag).toEqual({ $ne: true });
  });

  it("bu filtreler yokken ana akış sayfasını bozmaz", () => {
    const query = buildCarQuery({} as any) as any;
    expect(query.mileage).toBeUndefined();
    expect(query.damageFlag).toBeUndefined();
  });
});

describe("arama kelime eşleşmesi", () => {
  it("varsayılan eşleşme tüm kelimeleri ister", () => {
    expect(textSearchOptions("galeriden bmw 520i").matchCriteria).toBe("all");
  });

  it("yedek eşleşme en az bir kelimeyi yeterli sayar", () => {
    expect(textSearchOptions("galeriden bmw 520i", "any").matchCriteria).toBe("any");
  });
});
