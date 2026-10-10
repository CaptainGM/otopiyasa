import { describe, it, expect } from "vitest";
import {
  fitLinear,
  derivePainted,
  tryPredict,
  predictFromTiers,
  carAge,
  annualDepreciation,
  median,
  featureMedians,
  modelOffset,
  archiveWeight,
  effectiveSampleSize,
  ARCHIVE_MAX_AGE_DAYS,
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

describe("emsal sayısı", () => {
  it("marka regresyon havuzunu aynı-model emsal sayısı diye göstermez", async () => {
    const brandRows = Array.from({ length: 14 }, (_, i) => {
      const age = i + 1;
      return row(CY - age, 10000 * age, Math.round(2_000_000 * Math.pow(0.88, age)));
    });
    const prediction = await predictFromTiers(
      { segment: [], brand: async () => brandRows, global: async () => [] },
      { year: CY - 3, mileage: 30000, damaged: 0, painted: 0 },
      [],
      undefined,
      1
    );

    expect(prediction.method).toBe("brand");
    expect(prediction.sampleSize).toBe(1);
    expect(prediction.trainingSampleSize).toBe(brandRows.length);
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
    expect(derivePainted("Tamamı orjinal")).toBe(0);
    expect(derivePainted("Boya/değişen yok")).toBe(0);
    expect(derivePainted("Boyasız")).toBe(0);
    expect(derivePainted("1 değişen")).toBe(1);
    expect(derivePainted("Belirtilmemiş")).toBe(0);
    expect(derivePainted("")).toBe(0);
    expect(derivePainted(undefined)).toBe(0);
  });
});

describe("arşiv ilanları (ağırlıklı eğitim)", () => {
  const base = Array.from({ length: 10 }, (_, i) => {
    const age = i + 1;
    return row(CY - age, 12000 * age, Math.round(2_000_000 * Math.pow(0.9, age)));
  });
  const input = { year: CY - 3, mileage: 36000, damaged: 0, painted: 0, engineSize: 1.6, horsepower: 110, automatic: 0, diesel: 0 };

  it("arşiv ağırlığı aylık takvimle azalır: ilk ay 1,0, her ay 0,1 eksik, 6. ayda 0,5, sonrası 0", () => {
    const expected: Array<[number, number]> = [[0, 1], [29, 1], [30, 0.9], [59, 0.9], [60, 0.8], [90, 0.7], [120, 0.6], [150, 0.5], [179, 0.5]];
    for (const [days, weight] of expected) expect(archiveWeight(days)).toBeCloseTo(weight, 5);
    expect(archiveWeight(ARCHIVE_MAX_AGE_DAYS)).toBe(0);
    expect(archiveWeight(400)).toBe(0);
    expect(archiveWeight(-1)).toBe(0);
    expect(archiveWeight(NaN)).toBe(0);
  });

  it("arşiv ağırlığı yaşlandıkça hiç artmaz", () => {
    let previous = Infinity;
    for (let day = 0; day < 200; day += 7) {
      const w = archiveWeight(day);
      expect(w).toBeLessThanOrEqual(previous);
      previous = w;
    }
  });

  it("ağırlıksız çağrı eskisiyle aynı sonucu verir", () => {
    const a = fitLinear(base.map((r) => [1, carAge(r.year)]), base.map((r) => Math.log(r.price)), 1e-6);
    const b = fitLinear(base.map((r) => [1, carAge(r.year)]), base.map((r) => Math.log(r.price)), 1e-6, base.map(() => 1));
    expect(b!.coeffs[1]).toBeCloseTo(a!.coeffs[1], 8);
  });

  it("ağırlığı sıfıra yakın satır uyumu bozmaz, ağırlıklı satır çeker", () => {
    const X = [...base.map((r) => [1, carAge(r.year)]), [1, 2]];
    const y = [...base.map((r) => Math.log(r.price)), Math.log(100_000)]; // uç, yanlış fiyat
    const heavy = fitLinear(X, y, 1e-6, [...base.map(() => 1), 1])!;
    const light = fitLinear(X, y, 1e-6, [...base.map(() => 1), 0.001])!;
    const clean = fitLinear(X.slice(0, -1), y.slice(0, -1), 1e-6)!;
    expect(Math.abs(light.coeffs[1] - clean.coeffs[1])).toBeLessThan(Math.abs(heavy.coeffs[1] - clean.coeffs[1]));
  });

  it("etkin örnek sayısı ağırlıkların toplamıdır", () => {
    expect(effectiveSampleSize([{ ...base[0] }, { ...base[1], weight: 0.5, archived: true }])).toBeCloseTo(1.5);
  });

  it("etkin örnek az ise (çok arşiv, az aktif ağırlık) tahmin yapılmaz", () => {
    const tiny = Array.from({ length: 12 }, (_, i) => ({ ...base[i % 10], weight: 0.1, archived: true }));
    expect(tryPredict(tiny, input, "segment", [])).toBeNull();
  });

  it("arşiv satırları sampleSize'a girmez, archivedUsed olarak ayrıca sayılır", () => {
    const archived = Array.from({ length: 4 }, (_, i) => ({ ...base[i], weight: 0.3, archived: true }));
    const result = tryPredict([...base, ...archived], input, "segment", [])!;
    expect(result.archivedUsed).toBeGreaterThan(0);
    // Aykırı elenen satırlar da dahil toplam 14 satır: aktif + arşiv + elenen.
    expect(result.sampleSize + (result.archivedUsed ?? 0) + (result.outliersRemoved ?? 0)).toBe(base.length + archived.length);
    expect(result.sampleSize).toBeLessThanOrEqual(base.length);
  });

  it("arşiv yoksa archivedUsed alanı hiç yazılmaz", () => {
    expect(tryPredict(base, input, "segment", [])).not.toHaveProperty("archivedUsed");
  });

  it("modelOffset da ağırlıklıdır: hafif satır kaydırmayı az etkiler", () => {
    const coeffs = [14, -0.1, 0, 0, 0, 0, 0, 0, 0, 0];
    const medians = featureMedians(base);
    const full = modelOffset([row(CY - 3, 30000, 5_000_000)], coeffs, medians);
    const light = modelOffset([row(CY - 3, 30000, 5_000_000), { ...row(CY - 3, 30000, 5_000_000), weight: 0.2, archived: true }], coeffs, medians);
    expect(light).toBeGreaterThan(0);
    expect(full).toBeGreaterThan(0);
  });
});
