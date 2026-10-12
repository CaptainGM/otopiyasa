import { describe, expect, it } from "vitest";
import { isPlausibleMileage, maxPlausibleMileage, MAX_PLAUSIBLE_COMMERCIAL_MILEAGE, MAX_PLAUSIBLE_MILEAGE } from "@/lib/price-plausibility";

describe("isPlausibleMileage", () => {
  it("binek araçta 1 milyon km üstünü yazım hatası sayar", () => {
    expect(isPlausibleMileage(99_999_999, "otomobil")).toBe(false);
    expect(isPlausibleMileage(MAX_PLAUSIBLE_MILEAGE + 1, "suv-pickup")).toBe(false);
    expect(isPlausibleMileage(1_111_111, undefined)).toBe(false);
  });

  it("gerçekçi kilometreleri kabul eder, sıfır km dâhil", () => {
    expect(isPlausibleMileage(0, "otomobil")).toBe(true);
    expect(isPlausibleMileage(250_000, "otomobil")).toBe(true);
    expect(isPlausibleMileage(MAX_PLAUSIBLE_MILEAGE, "motosiklet")).toBe(true);
  });

  it("ticari araçta (kamyon, otobüs) üst sınır 3 milyon", () => {
    expect(maxPlausibleMileage("ticari")).toBe(MAX_PLAUSIBLE_COMMERCIAL_MILEAGE);
    expect(isPlausibleMileage(1_289_343, "ticari")).toBe(true);
    expect(isPlausibleMileage(3_500_000, "ticari")).toBe(false);
  });

  it("negatif ve sayı olmayan değerleri kabul etmez", () => {
    expect(isPlausibleMileage(-1, "otomobil")).toBe(false);
    expect(isPlausibleMileage(Number.NaN, "otomobil")).toBe(false);
  });
});
