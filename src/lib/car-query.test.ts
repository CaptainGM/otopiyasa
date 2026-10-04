import { describe, expect, it } from "vitest";
import { buildCarQuery, parseCarFilters } from "@/lib/car-query";

const filtersFrom = (qs: string) => parseCarFilters(new URLSearchParams(qs));


describe("parseCarFilters — sayfalama güvenliği", () => {
  it("sayfa numarasını en az 1'e sıkıştırır", () => {
    expect(filtersFrom("page=0").page).toBe(1);
    expect(filtersFrom("page=-5").page).toBe(1);
  });

  it("limit'i pozitif ve üst sınır içinde tutar", () => {
    expect(filtersFrom("limit=-1").limit).toBe(48);
    expect(filtersFrom("limit=0").limit).toBe(48);
    expect(filtersFrom("limit=99999").limit).toBe(48);
  });

  it("ondalık değerleri tam sayıya indirir", () => {
    expect(filtersFrom("page=2.9").page).toBe(2);
    expect(filtersFrom("limit=7.5").limit).toBe(7);
  });

  it("sayı olmayan/eksik değerlerde varsayılana döner", () => {
    expect(filtersFrom("page=abc").page).toBe(1);
    expect(filtersFrom("limit=abc").limit).toBe(48);
    expect(filtersFrom("").page).toBe(1);
    expect(filtersFrom("").limit).toBe(48);
  });

  it("makul değerlere dokunmaz", () => {
    const f = filtersFrom("page=3&limit=24");
    expect(f.page).toBe(3);
    expect(f.limit).toBe(24);
  });


  it("arama metnini kırpar", () => {
    const long = "a".repeat(5000);
    expect(filtersFrom(`q=${long}`).q?.length).toBe(100);
  });

  it("varsayılan sıralama karışık kalır", () => {
    expect(filtersFrom("").sort).toBe("mixed");
  });
});

describe("parseCarFilters — akış tohumu", () => {
  it("geçerli tohumu alır, eksik/bozuk değeri yok sayar", () => {
    expect(filtersFrom("seed=12345").seed).toBe(12345);
    expect(filtersFrom("").seed).toBeUndefined();
    expect(filtersFrom("seed=abc").seed).toBeUndefined();
    expect(filtersFrom("seed=-4").seed).toBeUndefined();
  });

  it("çok büyük tohumu üst sınıra çeker", () => {
    expect(filtersFrom("seed=99999999999999").seed).toBe(2_147_483_647);
  });
});

describe("renk filtresi", () => {
  it("ilan metnini aramak yerine seçilen renk alanını tam eşleştirir", () => {
    const filters = filtersFrom("color=beyaz");
    const query = buildCarQuery(filters);

    expect(query["features.color"]).toMatchObject({ $regex: "^Beyaz$", $options: "i" });
    expect(query.$and).toBeUndefined();
  });
});
