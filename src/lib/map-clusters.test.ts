import { describe, expect, it } from "vitest";
import { buildClusters, clusterKeyFor, distanceKm } from "./map-clusters";

const car = (city: string, address: string, price: number) => ({ city, address, price });

describe("clusterKeyFor", () => {
  it("adreste gerçek ilçe varsa ilçe kümesine düşer", () => {
    const placed = clusterKeyFor(car("İstanbul", "Hasanpaşa Mh. Kadıköy, İstanbul", 1_000_000));
    expect(placed?.level).toBe("district");
    expect(placed?.district).toBe("kadikoy");
    expect(placed?.key).toBe("İstanbul|kadikoy");
  });

  it("il-merkez ilçeleri de çözülür (eskiden çözülemiyordu)", () => {

    for (const [city, district] of [
      ["Kocaeli", "izmit"],
      ["Konya", "karatay"],
      ["Antalya", "muratpasa"],
      ["Eskişehir", "odunpazari"],
    ] as const) {
      const placed = clusterKeyFor(car(city, `X Mh. ${district}, ${city}`, 500_000));
      expect(placed?.level, `${city}/${district}`).toBe("district");
    }
  });

  it("ilçe bilinmiyorsa il kümesine düşer", () => {
    const placed = clusterKeyFor(car("İstanbul", "", 900_000));
    expect(placed?.level).toBe("province");
    expect(placed?.key).toBe("İstanbul|");
  });

  it("başka ildeki aynı adlı ilçeye kaymaz", () => {

    const placed = clusterKeyFor(car("Ankara", "Kadıköy Mah. Çankaya, Ankara", 800_000));
    expect(placed?.district).not.toBe("kadikoy");
  });
});

describe("buildClusters", () => {
  const cars = [
    car("İstanbul", "A Mh. Kadıköy, İstanbul", 900_000),
    car("İstanbul", "B Mh. Kadıköy, İstanbul", 750_000),
    car("İstanbul", "C Mh. Beşiktaş, İstanbul", 2_000_000),
    car("İstanbul", "", 600_000),
    car("Ankara", "D Mh. Çankaya, Ankara", 1_100_000),
  ];

  it("aynı ilçedeki ilanları tek kümede toplar", () => {
    const { clusters } = buildClusters(cars);
    const kadikoy = clusters.find((c) => c.district === "kadikoy");
    expect(kadikoy?.count).toBe(2);
    expect(kadikoy?.minPrice).toBe(750_000);
  });

  it("her ilan tam olarak bir kümeye girer", () => {
    const { clusters, total, unmapped } = buildClusters(cars);
    expect(clusters.reduce((s, c) => s + c.count, 0)).toBe(cars.length);
    expect(total).toBe(cars.length);
    expect(unmapped).toBe(0);
  });

  it("kalabalık kümeler önce sıralanır", () => {
    const { clusters } = buildClusters(cars);
    for (let i = 1; i < clusters.length; i++) {
      expect(clusters[i - 1].count).toBeGreaterThanOrEqual(clusters[i].count);
    }
  });

  it("haritalanamayan ilanı sayar, kümeye katmaz", () => {
    const { clusters, unmapped } = buildClusters([car("Atlantis", "", 1)]);
    expect(unmapped).toBe(1);
    expect(clusters).toHaveLength(0);
  });

  it("fiyatı olmayan ilanlarda minPrice 0'a düşer, NaN olmaz", () => {
    const { clusters } = buildClusters([car("İstanbul", "A Mh. Kadıköy, İstanbul", 0)]);
    expect(clusters[0].minPrice).toBe(0);
  });
});

describe("distanceKm", () => {
  it("İstanbul–Ankara arasını (~350 km) doğru hesaplar", () => {
    const d = distanceKm({ lat: 41.0082, lng: 28.9784 }, { lat: 39.9334, lng: 32.8597 });
    expect(d).toBeGreaterThan(320);
    expect(d).toBeLessThan(380);
  });

  it("aynı nokta için 0 döner", () => {
    expect(distanceKm({ lat: 41, lng: 29 }, { lat: 41, lng: 29 })).toBe(0);
  });
});
