import { describe, expect, it } from "vitest";
import { brandStorageAliases, isNonCarBrand, normalizeBrand } from "@/lib/normalize-brand";
import { normalizeCity, cityStorageAliases } from "@/lib/normalize-city";

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

  it("veri kaynağındaki marka varyantlarını tek seçeneğe toplar", () => {
    expect(normalizeBrand("Alfa")).toBe("Alfa Romeo");
    expect(normalizeBrand("Kgm Ssangyong")).toBe("KG Mobility");
    expect(normalizeBrand("Mercedes Benz")).toBe("Mercedes-Benz");
    expect(brandStorageAliases("KG Mobility")).toContain("Kgm Ssangyong");
  });
});

describe("normalizeCity", () => {
  it("büyük harf, Türkçe karakter ve bilinen yazım varyantlarını birleştirir", () => {
    expect(normalizeCity("İSTANBUL")).toBe("İstanbul");
    expect(normalizeCity("Elaziğ")).toBe("Elazığ");
    expect(normalizeCity("KIRŞEHİR")).toBe("Kırşehir");
  });

  it("kanonik şehir seçimi indeksli eşleşme için depolanan yazım varyantlarını üretir", () => {
    expect(cityStorageAliases("Elazığ")).toContain("Elaziğ");
    expect(cityStorageAliases("Elazığ")).toContain("ELAZIĞ");
    expect(cityStorageAliases("İstanbul")).toContain("İSTANBUL");
    expect(normalizeCity("Sakarya Hendek")).toBe("Sakarya Hendek");
    expect(cityStorageAliases("Sakarya")).not.toContain("Sakarya Hendek");
  });
});

describe("isNonCarBrand", () => {
  it("otomobil dışı kategorileri yakalar", () => {
    expect(isNonCarBrand("Motosiklet")).toBe(true);
    expect(isNonCarBrand("MOTORSIKLET")).toBe(true);
    expect(isNonCarBrand("Toyota")).toBe(false);
  });
});
