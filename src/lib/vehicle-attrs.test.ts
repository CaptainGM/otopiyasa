import { describe, expect, it } from "vitest";
import { automaticPremiumPct, mergeCategoryStats, normalizeBodyType, normalizeTransmission, normalizeVehicleTransmission, transmissionMatch } from "./vehicle-attrs";

describe("normalizeTransmission", () => {
  it("kaynak yazımlarını ortak yazıma çevirir", () => {
    expect(normalizeTransmission("Manuel")).toBe("Manuel");
    expect(normalizeTransmission("Düz")).toBe("Manuel");
    expect(normalizeTransmission("Otomatik")).toBe("Otomatik");
    expect(normalizeTransmission("Tiptronik")).toBe("Otomatik");
    expect(normalizeTransmission("Multitronic")).toBe("Otomatik");
    expect(normalizeTransmission("Yarı Otomatik")).toBe("Yarı Otomatik");
    expect(normalizeTransmission("Yarı Otomatik DCT")).toBe("Otomatik");
    expect(normalizeTransmission("7 ileri DCT")).toBe("Otomatik");
  });

  it("bilinmeyeni sayılmaz", () => {
    expect(normalizeTransmission("Bilinmiyor")).toBeNull();
    expect(normalizeTransmission("")).toBeNull();
    expect(normalizeTransmission(undefined)).toBeNull();
  });
});

describe("normalizeVehicleTransmission", () => {
  it("Chery Tiggo 7 Pro için yarı otomatik yazımını otomatikte birleştirir", () => {
    expect(normalizeVehicleTransmission("Yarı Otomatik", { brand: "Chery", model: "Tiggo 7 Pro" })).toBe("Otomatik");
    expect(normalizeVehicleTransmission("Otomatik", { brand: "CHERY", title: "Tiggo 7 Pro 1.6 TGDI" })).toBe("Otomatik");
    expect(normalizeVehicleTransmission("Yarı Otomatik", { brand: "Chery", model: "Tiggo 8 Pro" })).toBe("Yarı Otomatik");
  });
});

describe("transmissionMatch", () => {
  it("otomatik filtresinde yarı otomatik ve yaygın şanzıman adlarını da bulur", () => {
    const match = transmissionMatch("Otomatik");
    expect(typeof match).toBe("object");
    if (typeof match === "object") {
      const regex = new RegExp(match.$regex, match.$options);
      expect(regex.test("Yarı Otomatik")).toBe(true);
      expect(regex.test("CVT")).toBe(true);
      expect(regex.test("DCT")).toBe(true);
    }
  });
});

describe("normalizeBodyType", () => {
  it("büyük/küçük harf ve kaynak farklarını birleştirir", () => {
    expect(normalizeBodyType("SUV")).toBe("SUV");
    expect(normalizeBodyType("Suv")).toBe("SUV");
    expect(normalizeBodyType("Arazi aracı")).toBe("SUV");
    expect(normalizeBodyType("Crossover")).toBe("SUV");
    expect(normalizeBodyType("Hatchback 5 kapi")).toBe("Hatchback");
    expect(normalizeBodyType("Coupe 4 kapi")).toBe("Coupe");
    expect(normalizeBodyType("Kombi")).toBe("Station Wagon");
    expect(normalizeBodyType("Minivan / Van")).toBe("Minivan / Van");
    expect(normalizeBodyType("Cityvan")).toBe("Minivan / Van");
    expect(normalizeBodyType("Pick-up")).toBe("Pick-up");
  });

  it("yer tutucu 'Otomobil' ve belirtilmemişi sayılmaz", () => {
    expect(normalizeBodyType("Otomobil")).toBeNull();
    expect(normalizeBodyType("Belirtilmemiş")).toBeNull();
    expect(normalizeBodyType("")).toBeNull();
  });
});

describe("mergeCategoryStats", () => {
  it("ham satırları birleştirir, ağırlıklı ortalama alır ve payı tüm bilinen ilana göre hesaplar", () => {
    const stats = mergeCategoryStats(
      [
        { _id: "Otomatik", count: 100, avgPrice: 2_000_000 },
        { _id: "Tiptronik", count: 100, avgPrice: 3_000_000 },
        { _id: "Manuel", count: 300, avgPrice: 1_000_000 },
        { _id: "Bilinmiyor", count: 50, avgPrice: 500_000 },
      ],
      normalizeTransmission,
      3
    );
    expect(stats.map((s) => s.label)).toEqual(["Manuel", "Otomatik"]);
    const auto = stats.find((s) => s.label === "Otomatik")!;
    expect(auto.count).toBe(200);
    expect(auto.avgPrice).toBe(2_500_000);
    expect(auto.sharePct).toBe(40);
    expect(stats.find((s) => s.label === "Manuel")!.sharePct).toBe(60);
  });

  it("limit uygular ama yüzdeleri kesmez", () => {
    const stats = mergeCategoryStats(
      [
        { _id: "SUV", count: 50, avgPrice: 1 },
        { _id: "Suv", count: 50, avgPrice: 1 },
        { _id: "Sedan", count: 40, avgPrice: 1 },
        { _id: "Hatchback", count: 10, avgPrice: 1 },
      ],
      normalizeBodyType,
      2
    );
    expect(stats).toHaveLength(2);
    expect(stats[0]).toMatchObject({ label: "SUV", count: 100, sharePct: 67 });
    expect(stats[1]).toMatchObject({ label: "Sedan", sharePct: 27 });
  });
});

describe("automaticPremiumPct", () => {
  it("otomatik/manuel fiyat farkını yüzde olarak verir", () => {
    expect(automaticPremiumPct([{ label: "Otomatik", avgPrice: 1_500_000 }, { label: "Manuel", avgPrice: 1_000_000 }])).toBe(50);
  });
  it("biri yoksa null döner", () => {
    expect(automaticPremiumPct([{ label: "Manuel", avgPrice: 1_000_000 }])).toBeNull();
  });
});

describe("transmissionMatch", () => {
  it("Otomatik filtresi Tiptronik/Multitronic kayıtlarını da kapsar", () => {
    const match = transmissionMatch("Otomatik") as { $regex: string; $options: string };
    const re = new RegExp(match.$regex, match.$options);
    expect(re.test("Otomatik")).toBe(true);
    expect(re.test("Tiptronik")).toBe(true);
    expect(re.test("Multitronic")).toBe(true);
    expect(re.test("DCT")).toBe(true);
    expect(re.test("DSG")).toBe(true);
    expect(re.test("Yarı Otomatik")).toBe(true);
    expect(re.test("Manuel")).toBe(false);
    expect(re.test("Manuel")).toBe(false);
  });

  it("Manuel filtresi Düz'ü de kapsar", () => {
    const match = transmissionMatch("Manuel") as { $regex: string; $options: string };
    const re = new RegExp(match.$regex, match.$options);
    expect(re.test("Manuel")).toBe(true);
    expect(re.test("Düz")).toBe(true);
    expect(re.test("Otomatik")).toBe(false);
  });
});
