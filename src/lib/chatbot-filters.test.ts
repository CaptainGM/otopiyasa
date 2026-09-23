import { describe, expect, it } from "vitest";
import { parseFilterCriteria } from "./chatbot";

describe("parseFilterCriteria — bileşik chatbot sorguları", () => {
  it("'2020'den sonraki 1.5 milyon altı' → yearMin + priceMax", () => {
    const c = parseFilterCriteria("2020'den sonraki 1.5 milyon altı araba önerir misin");
    expect(c.yearMin).toBe(2020);
    expect(c.priceMax).toBe(1_500_000);
    expect(c.yearMax).toBeUndefined();
  });

  it("'500 bin ile 1 milyon arası dizel' → priceMin + priceMax + yakıt", () => {
    const c = parseFilterCriteria("500 bin ile 1 milyon arası dizel araç");
    expect(c.priceMin).toBe(500_000);
    expect(c.priceMax).toBe(1_000_000);
    expect(c.fuelType).toBe("Dizel");
  });

  it("'2018 üstü' → yearMin (fiyat yok)", () => {
    const c = parseFilterCriteria("2018 üstü BMW göster");
    expect(c.yearMin).toBe(2018);
    expect(c.priceMin).toBeUndefined();
    expect(c.priceMax).toBeUndefined();
  });

  it("'2015 öncesi' → yearMax", () => {
    expect(parseFilterCriteria("2015 öncesi araçlar").yearMax).toBe(2015);
  });

  it("'800 bin altı' → priceMax", () => {
    expect(parseFilterCriteria("800 bin altında bir şey").priceMax).toBe(800_000);
  });

  it("'1 milyon üstü' → priceMin", () => {
    expect(parseFilterCriteria("1 milyon üstü lüks araba").priceMin).toBe(1_000_000);
  });

  it("yakıt türlerini tanır", () => {
    expect(parseFilterCriteria("elektrikli araç").fuelType).toBe("Elektrik");
    expect(parseFilterCriteria("hibrit model").fuelType).toBe("Hibrit");
    expect(parseFilterCriteria("lpg'li").fuelType).toBe("LPG & Benzin");
  });

  it("ölçüt yoksa boş döner", () => {
    const c = parseFilterCriteria("merhaba nasılsın");
    expect(c.yearMin).toBeUndefined();
    expect(c.priceMax).toBeUndefined();
    expect(c.fuelType).toBeUndefined();
  });
});
