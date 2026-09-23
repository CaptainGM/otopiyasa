import { describe, it, expect } from "vitest";
import {
  fitLinear,
  derivePainted,
  tryPredict,
  carAge,
  annualDepreciation,
  median,
  featureMedians,
  modelOffset,
} from "./price-prediction";

const CY = new Date().getFullYear();


function row(
  year: number,
  mileage: number,
  price: number,
  extra: Partial<{
    damaged: number;
    painted: number;
    engineSize: number | null;
    horsepower: number | null;
    automatic: number;
    diesel: number;
  }> = {}
) {
  return {
    year,
    mileage,
    price,
    damaged: 0,
    painted: 0,
    engineSize: 1.6,
    horsepower: 110,
    automatic: 0,
    diesel: 0,
    ...extra,
  };
}

describe("fitLinear (genel OLS)", () => {
  it("çok değişkenli doğrusal ilişkiyi geri kazanır", () => {
   
    const X = [
      [1, 1, 1], [1, 2, 1], [1, 1, 2], [1, 3, 2],
      [1, 2, 3], [1, 4, 1], [1, 3, 3], [1, 5, 2],
    ];
    const y = X.map(([, a, b]) => 100 + 2 * a + 3 * b);
    const fit = fitLinear(X, y);
    expect(fit).not.toBeNull();
    expect(fit!.coeffs[0]).toBeCloseTo(100, 2);
    expect(fit!.coeffs[1]).toBeCloseTo(2, 2);
    expect(fit!.coeffs[2]).toBeCloseTo(3, 2);
    expect(fit!.r2).toBeCloseTo(1, 4);
  });

  it("örnek sayısı özellik sayısından azsa null döner", () => {
    expect(fitLinear([[1, 1]], [5])).toBeNull();
  });

  it("sabit sütun içeren matris: saf OLS tekil, ridge çözer", () => {
    
    const X = [
      [1, 1, 0], [1, 2, 0], [1, 3, 0], [1, 4, 0],
    ];
    const y = [10, 12, 14, 16];
    expect(fitLinear(X, y)).toBeNull(); 
    expect(fitLinear(X, y, 1e-3)).not.toBeNull(); 
  });
});

describe("carAge", () => {
  it("yaşı hesaplar, gelecek modeli 0'a kırpar", () => {
    expect(carAge(CY)).toBe(0);
    expect(carAge(CY - 5)).toBe(5);
    expect(carAge(CY + 2)).toBe(0);
  });
});

describe("median / featureMedians", () => {
  it("tek ve çift uzunlukta doğru medyan", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it("eksik motor/beygir değerlerini medyana katmaz", () => {
    const rows = [
      row(CY - 1, 10000, 1_000_000, { engineSize: 1.0, horsepower: 100 }),
      row(CY - 2, 20000, 900_000, { engineSize: 2.0, horsepower: 200 }),
      row(CY - 3, 30000, 800_000, { engineSize: null, horsepower: null }),
    ];
    const m = featureMedians(rows);
    expect(m.engineSize).toBe(1.5);
    expect(m.horsepower).toBe(150);
  });
});

describe("tryPredict (log-fiyat + yaş + donanım regresyonu)", () => {
  
  const rows = Array.from({ length: 14 }, (_, i) => {
    const age = i + 1;
    return row(CY - age, 10000 * age, Math.round(2_000_000 * Math.pow(0.88, age)), {
      damaged: age % 5 === 0 ? 1 : 0,
      painted: age % 3 === 0 ? 1 : 0,
      engineSize: 1.4 + (age % 3) * 0.2,
      horsepower: 100 + (age % 3) * 25,
    });
  });

  it("genç araç, yaşlı araçtan daha pahalı tahmin edilir", () => {
    const young = tryPredict(rows, { year: CY - 2, mileage: 20000, damaged: 0, painted: 0 }, "segment", []);
    const old = tryPredict(rows, { year: CY - 8, mileage: 80000, damaged: 0, painted: 0 }, "segment", []);
    expect(young).not.toBeNull();
    expect(old).not.toBeNull();
    expect(young!.predictedPrice).toBeGreaterThan(old!.predictedPrice);
    expect(old!.predictedPrice).toBeGreaterThan(0);
  });

  it("aşırı ekstrapolasyonda bile tahmin negatif olamaz (log/exp)", () => {
    const ancient = tryPredict(rows, { year: CY - 30, mileage: 400000, damaged: 0, painted: 0 }, "segment", []);
    if (ancient) expect(ancient.predictedPrice).toBeGreaterThan(0);
  });

  it("örnek sayısı eşiğin altındaysa null döner", () => {
    expect(
      tryPredict(rows.slice(0, 3), { year: CY - 2, mileage: 20000, damaged: 0, painted: 0 }, "segment", [])
    ).toBeNull();
  });

  it("yanlış girilmiş uç fiyatı aykırı sayıp eler", () => {
    
    const temiz = tryPredict(rows, { year: CY - 3, mileage: 30000, damaged: 0, painted: 0 }, "segment", [])!;
    const kirli = tryPredict(
      [...rows, row(CY - 3, 30000, 1)],
      { year: CY - 3, mileage: 30000, damaged: 0, painted: 0 },
      "segment",
      []
    )!;
    expect(kirli.outliersRemoved).toBeGreaterThan(0);
  
    expect(Math.abs(kirli.predictedPrice - temiz.predictedPrice) / temiz.predictedPrice).toBeLessThan(0.15);
  });

  it("aykırı eleme örneklemin en fazla %20'sini atar", () => {
    const yarisiBozuk = [...rows, ...Array.from({ length: 14 }, () => row(CY - 3, 30000, 1))];
    const sonuc = tryPredict(yarisiBozuk, { year: CY - 3, mileage: 30000, damaged: 0, painted: 0 }, "segment", [])!;
    expect(sonuc.outliersRemoved).toBeLessThanOrEqual(Math.floor(yarisiBozuk.length * 0.2));
  });

  it("güven aralığı tahmini içerir ve pozitiftir", () => {
    const p = tryPredict(rows, { year: CY - 4, mileage: 40000, damaged: 0, painted: 0 }, "segment", [])!;
    expect(p.lowerBound!).toBeGreaterThan(0);
    expect(p.lowerBound!).toBeLessThanOrEqual(p.predictedPrice);
    expect(p.upperBound!).toBeGreaterThanOrEqual(p.predictedPrice);
  });
});

describe("modelOffset (kısmi havuzlama)", () => {
  
  const brandRows = Array.from({ length: 20 }, (_, i) => {
    const age = (i % 10) + 1;
    return row(CY - age, 10000 * age, Math.round(1_000_000 * Math.pow(0.9, age)));
  });
  const fit = tryPredict(brandRows, { year: CY - 3, mileage: 30000, damaged: 0, painted: 0 }, "brand", [])!;

  it("segment boşsa kaydırma yapmaz", () => {
    expect(modelOffset([], fit.coeffs!, fit.medians!)).toBe(0);
  });

  it("markadan pahalı bir model tahmini YUKARI kaydırır", () => {
    const pahali = [row(CY - 3, 30000, Math.round(1_000_000 * Math.pow(0.9, 3) * 2))];
    expect(modelOffset(pahali, fit.coeffs!, fit.medians!)).toBeGreaterThan(0);
  });

  it("markadan ucuz bir model tahmini AŞAĞI kaydırır", () => {
    const ucuz = [row(CY - 3, 30000, Math.round(1_000_000 * Math.pow(0.9, 3) * 0.5))];
    expect(modelOffset(ucuz, fit.coeffs!, fit.medians!)).toBeLessThan(0);
  });

  it("tek ilanlık kanıt, çok ilanlıya göre daha az güvenilir (shrinkage)", () => {
    const price = Math.round(1_000_000 * Math.pow(0.9, 3) * 2);
    const bir = modelOffset([row(CY - 3, 30000, price)], fit.coeffs!, fit.medians!);
    const dokuz = modelOffset(
      Array.from({ length: 9 }, () => row(CY - 3, 30000, price)),
      fit.coeffs!,
      fit.medians!
    );

    expect(dokuz).toBeGreaterThan(bir);
  });
});

describe("annualDepreciation", () => {
  it("yıllık %10 değer kaybını (~) geri kazanır", () => {
    
    const rows = Array.from({ length: 10 }, (_, i) =>
      row(CY - (i + 1), 10000 * (i + 1), Math.round(2_000_000 * Math.pow(0.9, i + 1)))
    );
    const dep = annualDepreciation(rows);
    expect(dep).not.toBeNull();
    expect(dep!).toBeGreaterThan(7);
    expect(dep!).toBeLessThan(13);
  });

  it("veri azsa null döner", () => {
    expect(annualDepreciation([])).toBeNull();
  });
});

describe("derivePainted", () => {
  it("boya/değişen ifadelerini yakalar, orijinali ayırır", () => {
    expect(derivePainted("1 boyalı, 2 lokal boyalı")).toBe(1);
    expect(derivePainted("Tamamı orijinal")).toBe(0);
    expect(derivePainted("Belirtilmemiş")).toBe(0);
    expect(derivePainted("")).toBe(0);
    expect(derivePainted(undefined)).toBe(0);
  });
});
