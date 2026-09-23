import { describe, expect, it } from "vitest";
import { buildBrandTrends, parseTurkishDate } from "@/lib/brand-trends";

describe("parseTurkishDate", () => {
  it("Türkçe tarihleri ayrıştırır", () => {
    const date = parseTurkishDate("20 Temmuz 2026");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(6);
    expect(date?.getDate()).toBe(20);
  });

  it("büyük/küçük harf ve Türkçe karakterleri tolere eder", () => {
    expect(parseTurkishDate("5 AĞUSTOS 2025")?.getMonth()).toBe(7);
    expect(parseTurkishDate("1 şubat 2026")?.getMonth()).toBe(1);
  });

  it("tanınmayan biçimde null döner", () => {
    expect(parseTurkishDate("2026-07-20")).toBeNull();
    expect(parseTurkishDate(undefined)).toBeNull();
    expect(parseTurkishDate("20 July 2026")).toBeNull();
  });
});

describe("buildBrandTrends", () => {
  const cars = [
    { brand: "Toyota", price: 1_000_000, listingDate: "10 Haziran 2026" },
    { brand: "Toyota", price: 1_200_000, listingDate: "20 Haziran 2026" },
    { brand: "Toyota", price: 1_400_000, listingDate: "5 Temmuz 2026" },
    { brand: "Renault", price: 800_000, listingDate: "15 Temmuz 2026" },
    { brand: "Renault", price: 900_000, createdAt: new Date(2026, 6, 18) },
  ];

  it("ay bazında marka ortalamalarını hesaplar", () => {
    const trends = buildBrandTrends(cars);
    expect(trends.brands).toEqual(["Toyota", "Renault"]);
    expect(trends.points).toHaveLength(2);

    const june = trends.points[0];
    expect(june.month).toBe("Haz 26");
    expect(june["Toyota"]).toBe(1_100_000);
    expect(june["Renault"]).toBeNull();

    const july = trends.points[1];
    expect(july["Toyota"]).toBe(1_400_000);
    expect(july["Renault"]).toBe(850_000);
  });

  it("marka sayısını maxBrands ile sınırlar", () => {
    const trends = buildBrandTrends(cars, 1);
    expect(trends.brands).toEqual(["Toyota"]);
  });

  it("tarihsiz ve fiyatsız kayıtları atlar", () => {
    const trends = buildBrandTrends([{ brand: "Fiat", price: 0, listingDate: "1 Ocak 2026" }]);
    expect(trends.points).toHaveLength(0);
  });
});
