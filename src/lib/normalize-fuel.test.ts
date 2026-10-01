import { describe, expect, it } from "vitest";
import { normalizeFuelType } from "./normalize-fuel";

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
