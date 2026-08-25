import { describe, expect, it } from "vitest";
import { isNonCarBrand, normalizeBrand } from "@/lib/normalize-brand";

describe("normalizeBrand", () => {
  it("büyük/küçük harf farklarını tek biçime indirger", () => {
    expect(normalizeBrand("BMW")).toBe("BMW");
    expect(normalizeBrand("Bmw")).toBe("BMW");
    expect(normalizeBrand("TOYOTA")).toBe("Toyota");
    expect(normalizeBrand("alfa romeo")).toBe("Alfa Romeo");
  });

  it("büyük harfli Latin markalardaki 'I'yı bozmaz (Türkçe küçültme hatası)", () => {
    expect(normalizeBrand("CITROEN")).toBe("Citroen");
    expect(normalizeBrand("FIAT")).toBe("Fiat");
    expect(normalizeBrand("KIA")).toBe("Kia");
    expect(normalizeBrand("HYUNDAI")).toBe("Hyundai");
    expect(normalizeBrand("SUZUKI")).toBe("Suzuki");
  });

  it("boşluklu tire yazımını düzeltir ve alias uygular", () => {
    expect(normalizeBrand("Mercedes - Benz")).toBe("Mercedes-Benz");
    expect(normalizeBrand("Mercedes")).toBe("Mercedes-Benz");
    expect(normalizeBrand("mercedes-benz")).toBe("Mercedes-Benz");
    expect(normalizeBrand("VW")).toBe("Volkswagen");
  });

  it("boş değerde 'Bilinmiyor' döner", () => {
    expect(normalizeBrand("  ")).toBe("Bilinmiyor");
  });
});

describe("isNonCarBrand", () => {
  it("otomobil dışı kategorileri yakalar", () => {
    expect(isNonCarBrand("Motosiklet")).toBe(true);
    expect(isNonCarBrand("MOTORSIKLET")).toBe(true);
    expect(isNonCarBrand("Toyota")).toBe(false);
  });
});
