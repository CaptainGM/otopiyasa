import { describe, expect, it } from "vitest";
import { brandStorageAliases, isNonCarBrand, normalizeBrand, normalizeBrandModel } from "@/lib/normalize-brand";
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

describe("normalizeBrandModel", () => {
  it("ilk boşluktan bölünmüş iki kelimelik markaları birleştirir", () => {
    expect(normalizeBrandModel("Mercedes", "- Benz G 400 D")).toEqual({ brand: "Mercedes-Benz", model: "G 400 D" });
    expect(normalizeBrandModel("Land", "Rover Range Velar 2.0 TD4 SE")).toEqual({ brand: "Land Rover", model: "Range Rover Velar 2.0 TD4 SE" });
    expect(normalizeBrandModel("Land", "Rover Range 3.0 SDV8")).toEqual({ brand: "Land Rover", model: "Range Rover 3.0 SDV8" });
    expect(normalizeBrandModel("Land", "Rover Defender 110 2.0 S")).toEqual({ brand: "Land Rover", model: "Defender 110 2.0 S" });
    expect(normalizeBrandModel("Alfa", "Romeo Giulietta 1.6 JTD")).toEqual({ brand: "Alfa Romeo", model: "Giulietta 1.6 JTD" });
    expect(normalizeBrandModel("Range Rover", "Velar")).toEqual({ brand: "Land Rover", model: "Range Rover Velar" });
  });

  it("modelin başında tekrarlanan markayı atar, bitişik adları korur", () => {
    expect(normalizeBrandModel("Toyota", "TOYOTA COROLLA")).toEqual({ brand: "Toyota", model: "COROLLA" });
    expect(normalizeBrandModel("MG", "MG ZS EV")).toEqual({ brand: "MG", model: "ZS EV" });
    expect(normalizeBrandModel("DS", "DS4")).toEqual({ brand: "DS", model: "DS4" });
    expect(normalizeBrandModel("Mini", "Mini")).toEqual({ brand: "Mini", model: "Mini" });
    expect(normalizeBrandModel("Nissan", "MCQASHQAI1.6DCIX-TRONIC")).toEqual({ brand: "Nissan", model: "QASHQAI1.6DCIX-TRONIC" });
    expect(normalizeBrandModel("Nissan", "MC X TRAIL 1.6 DCI")).toEqual({ brand: "Nissan", model: "X TRAIL 1.6 DCI" });
    expect(normalizeBrandModel("Nissan", "Micra")).toEqual({ brand: "Nissan", model: "Micra" });
  });

  it("doğru kayıtlara ve gerçek Rover markasına dokunmaz, yazımı düzeltir", () => {
    expect(normalizeBrandModel("Land Rover", "Range Rover Sport 3.0")).toEqual({ brand: "Land Rover", model: "Range Rover Sport 3.0" });
    expect(normalizeBrandModel("Rover", "216")).toEqual({ brand: "Rover", model: "216" });
    expect(normalizeBrandModel("Fıat", "Egea 1.3 Multijet")).toEqual({ brand: "Fiat", model: "Egea 1.3 Multijet" });
    expect(normalizeBrandModel("Tofaş", "Şahin 1.6")).toEqual({ brand: "Tofaş", model: "Şahin 1.6" });
    expect(normalizeBrandModel("TOFAŞ", "Doğan")).toEqual({ brand: "Tofaş", model: "Doğan" });
  });
});
