import { describe, expect, it } from "vitest";
import { fuelWithTitleHint, normalizeFuelType } from "./normalize-fuel";

describe("normalizeFuelType", () => {
  it("LPG'nin tüm yazımlarını tek değere indirger", () => {
    for (const v of ["LPG & Benzin", "Benzin & LPG", "Lpg", "LPG", "lpg"]) {
      expect(normalizeFuelType(v)).toBe("LPG & Benzin");
    }
  });

  it("diğer yakıtları Türkçe tek yazıma çevirir", () => {
    expect(normalizeFuelType("Hybrid")).toBe("Hibrit");
    expect(normalizeFuelType("hibrit")).toBe("Hibrit");
    expect(normalizeFuelType("Diesel")).toBe("Dizel");
    expect(normalizeFuelType("dizel")).toBe("Dizel");
    expect(normalizeFuelType("Elektrik")).toBe("Elektrik");
    expect(normalizeFuelType("benzin")).toBe("Benzin");
    // Kurumsal kaynağın araç kaydı pompadaki adı kullanıyor.
    expect(normalizeFuelType("Kurşunsuz")).toBe("Benzin");
    expect(normalizeFuelType("Premium Kurşunsuz")).toBe("Benzin");
    expect(normalizeFuelType("MHEV")).toBe("Hibrit");
  });

  it("boş ve bilinmeyen değerleri korur", () => {
    expect(normalizeFuelType("")).toBe("Bilinmiyor");
    expect(normalizeFuelType(undefined)).toBe("Bilinmiyor");
    expect(normalizeFuelType("Bilinmiyor")).toBe("Bilinmiyor");
    expect(normalizeFuelType("Hidrojen")).toBe("Hidrojen");
  });
});

describe("fuelWithTitleHint", () => {
  it("başlığında şarjlı hibrit ifadesi olan benzinli kaydı hibrit yapar", () => {
    expect(fuelWithTitleHint("Benzin", "2023 DS9 1.6 E-TENSE PLUG-İN HİBRİT OPERA")).toBe("Hibrit");
    expect(fuelWithTitleHint("Benzin", "Sahibinden MG HS T Plug-in 2024 Model")).toBe("Hibrit");
    expect(fuelWithTitleHint("Benzin", "X1 xDrive25e PHEV")).toBe("Hibrit");
  });

  it("hafif hibrit ya da ifadesiz başlığa, elektrik ve LPG kaydına dokunmaz", () => {
    expect(fuelWithTitleHint("Benzin", "Nissan Qashqai 1.3 MHEV")).toBe("Benzin");
    expect(fuelWithTitleHint("Benzin", "Toyota Corolla 1.8 Hybrid")).toBe("Benzin");
    expect(fuelWithTitleHint("Elektrik", "Plug-in")).toBe("Elektrik");
    expect(fuelWithTitleHint("Benzin & LPG", "Plug-in")).toBe("LPG & Benzin");
  });
});
