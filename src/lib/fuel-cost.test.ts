import { describe, expect, it } from "vitest";
import { baseModel, bodyClass, buildConsumptionStats, computeFuelCost, engineFromText, parseConsumption, type ConsumptionSample } from "./fuel-cost";

const prices = {
  source: "test",
  fetchedAt: new Date("2026-10-01T06:00:00Z"),
  cities: [{ key: "ISTANBUL (AVRUPA)", name: "ISTANBUL (AVRUPA)", benzin: 84.5, dizel: 97.1, lpg: 36.44 }],
  average: { benzin: 86.28, dizel: 98.93, lpg: 36.85 },
};

// Sınıf ortalamaları için yeterli örnek (≥20): SUV benzinli 7 lt, sedan dizel 4,5 lt.
const samples: ConsumptionSample[] = [
  ...Array.from({ length: 25 }, () => ({ brand: "X", model: "Y", fuelType: "Benzin", bodyType: "SUV", consumption: 7 })),
  ...Array.from({ length: 25 }, () => ({ brand: "Fiat", model: "Egea", engineSize: 1.3, fuelType: "Dizel", bodyType: "Sedan", consumption: 4.5 })),
  ...Array.from({ length: 3 }, () => ({ brand: "Renault", model: "Clio", engineSize: 1.0, fuelType: "Benzin", bodyType: "Hatchback", consumption: 5.2 })),
  // Aynı aracı bir kaynak donanımıyla, diğeri pompa adıyla ("Kurşunsuz") yazıyor; motor alanı da aralık (1.2).
  ...Array.from({ length: 2 }, () => ({ brand: "Nissan", model: "Qashqai 1.3 DIG-T Sky Pack", engineSize: 1.2, fuelType: "Benzin", bodyType: "SUV", consumption: 5.8 })),
  { brand: "Nissan", model: "QASHQAI 1.3DIG-T MHEV", engineSize: 1.3, fuelType: "Kurşunsuz", bodyType: "SUV", consumption: 5.4 },
  ...Array.from({ length: 3 }, () => ({ brand: "Nissan", model: "Qashqai 1.5 dCi Tekna", fuelType: "Dizel", bodyType: "SUV", consumption: 4.1 })),
];
const stats = buildConsumptionStats(samples);

describe("parseConsumption", () => {
  it("ilandaki metni sayıya çevirir", () => {
    expect(parseConsumption("5,4 lt")).toBe(5.4);
    expect(parseConsumption("12.5 lt")).toBe(12.5);
  });
  it("gerçek dışı ve boş değerleri atar", () => {
    expect(parseConsumption("0,8 lt")).toBeNull();
    expect(parseConsumption("40 lt")).toBeNull();
    expect(parseConsumption("")).toBeNull();
    expect(parseConsumption(undefined)).toBeNull();
  });
});

describe("computeFuelCost", () => {
  it("resmi tüketim × ilin motorin fiyatıyla km başı maliyeti hesaplar", () => {
    const cost = computeFuelCost(
      { brand: "Fiat", model: "Egea", city: "İstanbul", features: { fuelType: "Dizel", bodyType: "Sedan", avgFuelConsumption: "4,5 lt" } },
      prices,
      stats
    )!;
    expect(cost.priceFuel).toBe("motorin");
    expect(cost.pricePerLiter).toBe(97.1);
    expect(cost.per100Km).toBeCloseTo(436.95, 2);
    expect(cost.perKm).toBeCloseTo(4.37, 2);
    expect(cost.consumptionSource).toBe("ilan");
    expect(cost.rating).toBeUndefined();
  });

  it("LPG'li araçta LPG fiyatını ve ~%20 fazla tüketimi kullanır, benzinle karşılaştırır", () => {
    const cost = computeFuelCost({ city: "Muş", features: { fuelType: "Benzin & LPG", avgFuelConsumption: "6 lt" } }, prices, stats)!;
    expect(cost.priceFuel).toBe("LPG");
    expect(cost.place).toBe("Türkiye ortalaması");
    expect(cost.per100Km).toBeCloseTo(6 * 1.2 * 36.85, 2);
    expect(cost.petrolPer100Km).toBeCloseTo(6 * 86.28, 2);
  });

  it("ilanda tüketim yoksa aynı model ve motorun resmi değerini kullanır", () => {
    const cost = computeFuelCost({ brand: "Renault", model: "Clio", city: "İstanbul", features: { fuelType: "Benzin", engineSize: 1.0 } }, prices, stats)!;
    expect(cost.consumption).toBe(5.2);
    expect(cost.consumptionSource).toBe("model");
  });

  it("model adı ve motor hacmi kaynaklar arasında farklı yazılsa da eşleşir", () => {
    const cost = computeFuelCost(
      { brand: "Nissan", model: "Qashqai", title: "Nissan Qashqai 1.3 DIG-T N Design", city: "İstanbul", features: { fuelType: "Benzin", engineSize: 1.3 } },
      prices,
      stats
    )!;
    expect(cost.consumption).toBe(5.8);
    expect(cost.consumptionNote).toBe("aynı model ve motordaki 3 ilanın resmi değeri");
  });

  it("motor eşleşmezse aynı modelin değerine düşer ve bunu söyler", () => {
    const cost = computeFuelCost({ brand: "Nissan", model: "Qashqai", title: "Nissan Qashqai 1.6 dCi", features: { fuelType: "Dizel" } }, prices, stats)!;
    expect(cost.consumption).toBe(4.1);
    expect(cost.consumptionNote).toBe("aynı modeldeki 3 ilanın resmi değeri");
  });

  it("tüketim de model verisi de yoksa uydurmaz", () => {
    expect(computeFuelCost({ brand: "Lada", model: "Niva", features: { fuelType: "Benzin" } }, prices, stats)).toBeNull();
  });

  it("elektrikli araçta hesap yapmaz", () => {
    expect(computeFuelCost({ features: { fuelType: "Elektrik", avgFuelConsumption: "5 lt" } }, prices, stats)).toBeNull();
  });

  it("sınıf ortalamasına göre az ya da çok yakıyor der", () => {
    const thirsty = computeFuelCost({ features: { fuelType: "Benzin", bodyType: "Suv", avgFuelConsumption: "9,5 lt" } }, prices, stats)!;
    expect(thirsty.rating).toBe("high");
    expect(thirsty.ratingText).toContain("SUV sınıfındaki benzinli araçların ortalaması 7 lt/100 km");
    const frugal = computeFuelCost({ features: { fuelType: "Benzin", bodyType: "SUV", avgFuelConsumption: "5,5 lt" } }, prices, stats)!;
    expect(frugal.rating).toBe("low");
  });

  it("plug-in hibritte uyarı notu düşer, sınıf karşılaştırması yapmaz", () => {
    const cost = computeFuelCost({ features: { fuelType: "Hibrit", avgFuelConsumption: "1,5 lt" } }, prices, stats)!;
    expect(cost.note).toContain("Plug-in");
    expect(cost.rating).toBeUndefined();
  });
});

describe("baseModel / engineFromText", () => {
  it("donanımı atıp model adını bırakır", () => {
    expect(baseModel("Qashqai 1.3 DIG-T Sky Pack")).toBe("qashqai");
    expect(baseModel("QASHQAI 1.3DIG-T MHEV PLATINUM")).toBe("qashqai");
    expect(baseModel("QASHQAI1.3DIG-TMHEVPLATINUMPR.")).toBe("qashqai");
    expect(baseModel("Qashqai")).toBe("qashqai");
    expect(baseModel("3 Serisi 320i ED Techno Plus")).toBe("3serisi");
    expect(baseModel("C 200 d AMG")).toBe("cserisi");
    expect(baseModel("")).toBe("");
  });

  it("motor hacmini metinden okur, km ve fiyatı karıştırmaz", () => {
    expect(engineFromText("Qashqai 1.3 DIG-T")).toBe(1.3);
    expect(engineFromText("QASHQAI 1.3DIG-T MHEV")).toBe(1.3);
    expect(engineFromText("Passat 2,0 TDI")).toBe(2);
    expect(engineFromText("Volkswagen POLO 2022 166.787 km")).toBeNull();
    expect(engineFromText("Qashqai", "Nissan Qashqai 1.3 DIG-T N Design")).toBe(1.3);
    expect(engineFromText("BMW 520d")).toBeNull();
  });
});

describe("bodyClass", () => {
  it("farklı yazımları aynı sınıfa toplar", () => {
    expect(bodyClass("Suv")).toBe("SUV");
    expect(bodyClass("Minivan / Van")).toBe("MPV / Van");
    expect(bodyClass("Belirtilmemiş")).toBeNull();
  });
});
