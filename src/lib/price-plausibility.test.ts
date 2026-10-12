import { describe, expect, it } from "vitest";
import { IMPLAUSIBLE_PRICE_QUERY, MAX_PLAUSIBLE_PRICE, isPlausibleListingPrice, minPlausiblePrice } from "@/lib/price-plausibility";

describe("isPlausibleListingPrice", () => {
  it("yazım hatası gibi görünen binek fiyatlarını reddeder", () => {
    expect(isPlausibleListingPrice(890_000_000, "otomobil")).toBe(false);
    expect(isPlausibleListingPrice(MAX_PLAUSIBLE_PRICE + 1, "suv-pickup")).toBe(false);
    expect(isPlausibleListingPrice(4_800_042_000, undefined)).toBe(false);
    expect(isPlausibleListingPrice(11_111, "otomobil")).toBe(false);
  });

  it("gerçek piyasa fiyatlarını kabul eder (lüks araçlar dahil)", () => {
    expect(isPlausibleListingPrice(2_299_750, "suv-pickup")).toBe(true);
    expect(isPlausibleListingPrice(21_000_000, "otomobil")).toBe(true);
    expect(isPlausibleListingPrice(MAX_PLAUSIBLE_PRICE, "otomobil")).toBe(true);
  });

  it("motosiklet, karavan ve ticari tiplerde alt sınır düşüktür", () => {
    expect(minPlausiblePrice("motosiklet")).toBe(5_000);
    expect(isPlausibleListingPrice(18_000, "motosiklet")).toBe(true);
    expect(isPlausibleListingPrice(18_000, "otomobil")).toBe(false);
    expect(minPlausiblePrice("minivan-panelvan")).toBe(20_000);
    expect(isPlausibleListingPrice(35_000, "otomobil")).toBe(true);
  });

  it("NaN ve sıfır fiyatı kabul etmez", () => {
    expect(isPlausibleListingPrice(Number.NaN, "otomobil")).toBe(false);
    expect(isPlausibleListingPrice(0, "otomobil")).toBe(false);
  });
});

describe("IMPLAUSIBLE_PRICE_QUERY", () => {
  it("üst sınırı, binek alt sınırını ve diğer tiplerin alt sınırını ayrı ayrı kapsar", () => {
    const clauses = IMPLAUSIBLE_PRICE_QUERY.$or;
    expect(clauses).toHaveLength(3);
    expect(clauses[0]).toEqual({ price: { $gt: MAX_PLAUSIBLE_PRICE } });
  });
});
