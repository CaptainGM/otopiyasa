import { describe, expect, it } from "vitest";
import { buildPriceScale, evenSample, median, packageKey, quantile, samePackage, type ScaleCar } from "@/lib/price-scale";

const dizel = { engineSize: 1.6, fuelType: "Dizel", transmission: "Manuel", horsepower: 115 };
const subject: ScaleCar = { price: 1_000_000, year: 2020, mileage: 40_000, damaged: false, ...dizel };

const car = (price: number, overrides: Partial<ScaleCar> = {}): ScaleCar => ({
  price,
  year: 2020,
  mileage: 41_000,
  damaged: false,
  ...dizel,
  ...overrides,
});

describe("median ve yüzdelik", () => {
  it("çift ve tek sayıda medyan", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([1, 2, 3])).toBe(2);
  });

  it("en yakın sıra yöntemiyle yüzdelik değer", () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2);
    expect(quantile([1, 2, 3, 4], 0.75)).toBe(3);
  });
});

describe("packageKey (donanım anahtarı)", () => {
  it("motor, yakıt, vites ve beygiri okur", () => {
    expect(packageKey(car(1))).toEqual({ engine: 1.6, fuel: "dizel", gear: "manuel", horsepower: 115 });
  });

  it("vites ve yakıt adlarını gruplara indirir", () => {
    expect(packageKey({ ...subject, transmission: "Yarı Otomatik" })?.gear).toBe("yari");
    expect(packageKey({ ...subject, transmission: "Tiptronik" })?.gear).toBe("otomatik");
    expect(packageKey({ ...subject, fuelType: "LPG & Benzin" })?.fuel).toBe("lpg");
  });

  it("vites ya da yakıt bilinmiyorsa donanım anahtarı üretmez", () => {
    expect(packageKey({ ...subject, transmission: "Bilinmiyor" })).toBeNull();
    expect(packageKey({ ...subject, fuelType: "" })).toBeNull();
  });

  it("elektrikli araçta motor hacmi 0 kabul edilir; anlamsız motor değeri donanımı bozar", () => {
    expect(packageKey({ ...subject, fuelType: "Elektrik", engineSize: 0.1 })?.engine).toBe(0);
    expect(packageKey({ ...subject, fuelType: "Benzin", engineSize: 0.1 })).toBeNull();
  });

  it("beygir ±%10 içinde aynı donanım sayılır", () => {
    const a = packageKey(car(1))!;
    expect(samePackage(a, { ...a, horsepower: 125 })).toBe(true);
    expect(samePackage(a, { ...a, horsepower: 130 })).toBe(false);
    expect(samePackage(a, { ...a, gear: "otomatik" })).toBe(false);
  });
});

describe("buildPriceScale", () => {
  it("aynı yıl, km, hasar ve donanımda tam kademe seçilir; konum ve istatistik doğru", () => {
    const candidates = [950_000, 980_000, 1_000_000, 1_020_000, 1_050_000, 1_100_000].map((p) => car(p));
    const scale = buildPriceScale(subject, candidates);
    const tam = scale.tiers.find((t) => t.key === "tam")!;
    expect(scale.chosen).toBe("tam");
    expect(scale.packageKnown).toBe(true);
    expect(tam).toMatchObject({ usable: true, n: 6, min: 950_000, max: 1_100_000, median: 1_010_000, mean: 1_016_667 });
    // Emsallerin 2'si (950 bin, 980 bin) bu ilandan ucuz: %33; medyana göre fark: (1.000.000 − 1.010.000) / 1.010.000 ≈ −%1
    expect(tam.cheaperPct).toBe(33);
    expect(tam.medianDiffPct).toBe(-1);
    expect(scale.sample).toEqual([950_000, 980_000, 1_000_000, 1_020_000, 1_050_000, 1_100_000]);
  });

  it("hasarlı emsaller tam kademeye girmez; yeterli değilse donanım kademesine düşer", () => {
    const undamaged = [900_000, 950_000, 1_000_000].map((p) => car(p));
    const damaged = [700_000, 720_000, 740_000, 760_000, 780_000].map((p) => car(p, { damaged: true }));
    const scale = buildPriceScale(subject, [...undamaged, ...damaged]);
    const tam = scale.tiers.find((t) => t.key === "tam")!;
    expect(tam.usable).toBe(false);
    expect(tam.n).toBe(3);
    expect(tam.note).toBe("en az 5 ilan gerekli");
    expect(scale.chosen).toBe("donanim");
  });

  it("donanım bilinmiyorsa donanım kademeleri uygulanamaz, km kademesi seçilir", () => {
    const candidates = [950_000, 980_000, 1_000_000, 1_020_000, 1_050_000, 1_100_000].map((p) => car(p));
    const scale = buildPriceScale({ ...subject, transmission: "Bilinmiyor" }, candidates);
    expect(scale.packageKnown).toBe(false);
    expect(scale.tiers.find((t) => t.key === "tam")!.note).toContain("donanım bilgisi");
    expect(scale.chosen).toBe("km");
  });

  it("km penceresi dışındaki ilanlar km kademesine girmez; yalnızca model ailesi kademesinde kalır", () => {
    const far = [1_000_000, 1_010_000, 1_020_000, 1_030_000, 1_040_000].map((p) => car(p, { mileage: 200_000 }));
    const scale = buildPriceScale({ ...subject, transmission: "Bilinmiyor" }, far);
    expect(scale.tiers.find((t) => t.key === "km")!.n).toBe(0);
    expect(scale.chosen).toBe("aile");
  });

  it("yeterli emsal yoksa hiçbir kademe seçilmez ve örnek boş kalır", () => {
    const scale = buildPriceScale(subject, [car(900_000), car(950_000)]);
    expect(scale.chosen).toBeNull();
    expect(scale.sample).toEqual([]);
    expect(scale.tiers.every((t) => !t.usable)).toBe(true);
  });

  it("elektrikli araçta donanım yakıt ve vitesle eşleşir", () => {
    const ev = { ...subject, fuelType: "Elektrik", engineSize: 0.1, horsepower: 204, transmission: "Otomatik" };
    const evCars = [900_000, 920_000, 940_000, 960_000, 980_000].map((p) => ({ ...ev, price: p, year: 2020, mileage: 41_000, damaged: false }));
    expect(buildPriceScale(ev, evCars).chosen).toBe("tam");
  });
});

describe("evenSample", () => {
  it("çok fazla noktayı en fazla 60 eşit aralıklı noktaya indirir ve uçları korur", () => {
    const sorted = Array.from({ length: 200 }, (_, i) => i + 1);
    const sample = evenSample(sorted);
    expect(sample).toHaveLength(60);
    expect(sample[0]).toBe(1);
    expect(sample[59]).toBe(200);
  });
});
