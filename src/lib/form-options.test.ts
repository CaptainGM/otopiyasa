import { describe, expect, it } from "vitest";
import {
  PROVINCES,
  districtsOf,
  formatNumberInput,
  parseNumberInput,
  maskName,
  SELL_COLORS,
} from "@/lib/form-options";

describe("il / ilçe listesi", () => {
  it("81 ili doğru Türkçe yazımıyla verir", () => {
    expect(PROVINCES).toHaveLength(81);
    expect(PROVINCES).toContain("İstanbul");
    expect(PROVINCES).toContain("Adıyaman");
    expect(PROVINCES).toContain("Afyonkarahisar");
    expect(PROVINCES).toContain("Kocaeli");
  });

  it("alfabetik sıralı", () => {
    expect(PROVINCES[0]).toBe("Adana");
  });

  it("ilçeleri doğru adla döner", () => {
    const ist = districtsOf("İstanbul");
    expect(ist.length).toBeGreaterThan(30);
    expect(ist).toContain("Kadıköy");
    expect(ist).toContain("Beşiktaş");
    expect(districtsOf("Kocaeli")).toContain("Gebze");
  });

  it("bilinmeyen ilde boş dizi", () => {
    expect(districtsOf("Yokşehir")).toEqual([]);
    expect(districtsOf("")).toEqual([]);
  });
});

describe("sayı biçimlendirme", () => {
  it("binlik ayraç ekler", () => {
    expect(formatNumberInput("1600000")).toBe("1.600.000");
    expect(formatNumberInput(950000)).toBe("950.000");
    expect(formatNumberInput("125000")).toBe("125.000");
  });

  it("harf/simge temizler", () => {
    expect(formatNumberInput("1.600.000 ₺")).toBe("1.600.000");
    expect(formatNumberInput("abc")).toBe("");
    expect(formatNumberInput("")).toBe("");
  });

  it("geri çevirir", () => {
    expect(parseNumberInput("1.600.000")).toBe(1600000);
    expect(parseNumberInput("")).toBe(0);
    expect(parseNumberInput("125.000 km")).toBe(125000);
  });

  it("gidiş-dönüş tutarlı", () => {
    expect(parseNumberInput(formatNumberInput("1600000"))).toBe(1600000);
  });
});

describe("isim maskeleme", () => {
  it("baş harfleri bırakır, gerisini gizler", () => {
    expect(maskName("Ahmet Yılmaz")).toBe("A**** Y*****");
    expect(maskName("Ali Veli Han")).toBe("A** V*** H**");
  });

  it("tek harfli ve boş girdiyi bozmaz", () => {
    expect(maskName("A")).toBe("A");
    expect(maskName("")).toBe("Üye");
    expect(maskName("   ")).toBe("Üye");
  });

  it("Türkçe harfleri doğru sayar", () => {
    // "Özkan" 5 harf → Ö + 4 yıldız
    expect(maskName("Özkan")).toBe("Ö****");
  });
});

describe("renk listesi", () => {
  it("en bilinen renkler başta", () => {
    expect(SELL_COLORS.slice(0, 5)).toEqual(["Beyaz", "Siyah", "Gri", "Gümüş Gri", "Kırmızı"]);
  });

  it("özel tonlar en üstte değil", () => {
    expect(SELL_COLORS.indexOf("Antrasit")).toBeGreaterThan(SELL_COLORS.indexOf("Mavi"));
  });
});
