import { describe, expect, it } from "vitest";
import { familyQuery, mileageWindow, rankSimilar, similarQuery } from "./comparables";

describe("rankSimilar", () => {
  const row = (year: number, mileage: number, id = `${year}-${mileage}`) => ({ id, year, mileage });

  it("2025 model bir aracın yanına 2001 modelini emsal olarak koymaz", () => {
    const candidates = [row(2024, 40000), row(2023, 90000), row(2001, 428000), row(2025, 30000), row(2018, 227800)];
    const picked = rankSimilar(candidates, { year: 2025, mileage: 37800 }, 12).map((c) => c.year);
    expect(picked).not.toContain(2001);
    expect(picked).not.toContain(2018);
    expect(picked[0]).toBe(2025);
  });

  it("yakın yıllar yeterliyse ±2 dışındaki adayları almaz", () => {
    const near = [row(2024, 40000), row(2023, 45000), row(2025, 30000), row(2024, 50000), row(2022, 60000)];
    const far = [row(2020, 40000), row(2021, 41000)];
    const picked = rankSimilar([...near, ...far], { year: 2024, mileage: 42000 }, 12).map((c) => c.year);
    expect(picked.every((y) => Math.abs(y - 2024) <= 2)).toBe(true);
  });

  it("yakın yıllarda aday azsa ±3 yıla genişler ama daha uzağa gitmez", () => {
    const candidates = [row(2022, 40000), row(2021, 41000), row(2020, 42000), row(2010, 43000)];
    const picked = rankSimilar(candidates, { year: 2024, mileage: 42000 }, 12).map((c) => c.year);
    expect(picked).toEqual(expect.arrayContaining([2022, 2021]));
    expect(picked).not.toContain(2010);
  });

  it("yıl farkı eşitse kilometresi yakın olan önce gelir", () => {
    const candidates = [row(2023, 150000, "uzak"), row(2023, 80000, "yakin")];
    const picked = rankSimilar(candidates, { year: 2023, mileage: 82000 }, 2).map((c) => c.id);
    expect(picked).toEqual(["yakin", "uzak"]);
  });

  it("limit uygulanır, yıl ve kilometre bilinmiyorsa sıralama yalnızca bilinen alana bakar", () => {
    const candidates = [row(2020, 100000), row(2021, 10000), row(2019, 5000)];
    expect(rankSimilar(candidates, {}, 2)).toHaveLength(2);
  });
});

describe("mileageWindow", () => {
  it("en az 30 bin km, yüksek kilometrede yarısı kadar", () => {
    expect(mileageWindow(20000)).toBe(30000);
    expect(mileageWindow(200000)).toBe(100000);
  });
});

describe("sorgu kuralları", () => {
  it("aile sorgusu model adının yazımından bağımsızdır (SCALA ve Scala 1.0 TSI aynı aile)", () => {
    const query = familyQuery({ brand: "Skoda", model: "SCALA" });
    const pattern = query.model as RegExp;
    expect(pattern.test("SCALA")).toBe(true);
    expect(pattern.test("Scala 1.0 TSI Style")).toBe(true);
    expect(pattern.test("Karoq")).toBe(false);
  });

  it("benzer ilan sorgusu yıl ve kilometre penceresi koyar", () => {
    const query = similarQuery({ brand: "BMW", model: "5 Serisi", year: 2025, mileage: 37800 });
    expect(query.year).toEqual({ $gte: 2022, $lte: 2028 });
    expect(query.mileage).toEqual({ $gte: 37800 - 30000, $lte: 37800 + 30000 });
  });

  it("araç sınıfı otomobil ise eski kayıtları (sınıfsız) da kapsar", () => {
    const query = familyQuery({ brand: "Fiat", model: "Egea", vehicleClass: "otomobil" });
    expect(query.vehicleClass).toEqual({ $in: ["otomobil", null] });
  });
});
