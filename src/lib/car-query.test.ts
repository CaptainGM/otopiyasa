import { describe, expect, it } from "vitest";
import { parseCarFilters } from "@/lib/car-query";

const filtersFrom = (qs: string) => parseCarFilters(new URLSearchParams(qs));


describe("parseCarFilters — sayfalama güvenliği", () => {
  it("sayfa numarasını en az 1'e sıkıştırır", () => {
    expect(filtersFrom("page=0").page).toBe(1);
    expect(filtersFrom("page=-5").page).toBe(1);
  });

  it("limit'i pozitif ve üst sınır içinde tutar", () => {
    expect(filtersFrom("limit=-1").limit).toBe(12); 
    expect(filtersFrom("limit=0").limit).toBe(12);
    expect(filtersFrom("limit=99999").limit).toBe(48);
  });

  it("ondalık değerleri tam sayıya indirir", () => {
    expect(filtersFrom("page=2.9").page).toBe(2);
    expect(filtersFrom("limit=7.5").limit).toBe(7);
  });

  it("sayı olmayan/eksik değerlerde varsayılana döner", () => {
    expect(filtersFrom("page=abc").page).toBe(1);
    expect(filtersFrom("limit=abc").limit).toBe(12);
    expect(filtersFrom("").page).toBe(1);
    expect(filtersFrom("").limit).toBe(12);
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
