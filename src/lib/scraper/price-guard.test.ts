import { describe, expect, it } from "vitest";
import { isPlausibleScrapedPrice } from "./price-guard";

describe("isPlausibleScrapedPrice", () => {
  it("accepts normal price moves and first known values", () => {
    expect(isPlausibleScrapedPrice(500_000, 450_000)).toBe(true);
    expect(isPlausibleScrapedPrice(undefined, 500_000)).toBe(true);
  });

  it("rejects missing prices and implausible parser jumps", () => {
    expect(isPlausibleScrapedPrice(500_000, 0)).toBe(false);
    expect(isPlausibleScrapedPrice(500_000, 50_000)).toBe(false);
    expect(isPlausibleScrapedPrice(500_000, 10_000_000)).toBe(false);
  });
});
