import { describe, expect, it } from "vitest";
import {
  checkPriceFloor,
  validateListingFields,
  median,
  ABSOLUTE_PRICE_FLOOR,
} from "./listing-validation";

const validListing = {
  brand: "Volkswagen",
  model: "Golf",
  year: 2018,
  price: 900_000,
  mileage: 90_000,
  city: "İstanbul",
  contactPhone: "0532 123 45 67",
  description: "Temiz araç",
};

describe("validateListingFields", () => {
  it("geçerli ilanı kabul eder", () => {
    expect(validateListingFields(validListing).valid).toBe(true);
  });

  it("eksik zorunlu alanları bildirir", () => {
    const r = validateListingFields({ ...validListing, brand: "", city: "" });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("gelecekteki ya da çok eski yılı reddeder", () => {
    expect(validateListingFields({ ...validListing, year: 1900 }).valid).toBe(false);
    expect(validateListingFields({ ...validListing, year: 2100 }).valid).toBe(false);
  });

  it("geçersiz telefonu reddeder", () => {
    expect(validateListingFields({ ...validListing, contactPhone: "abc" }).valid).toBe(false);
  });

  it("aşırı kilometreyi reddeder", () => {
    expect(validateListingFields({ ...validListing, mileage: 5_000_000 }).valid).toBe(false);
  });
});

describe("checkPriceFloor", () => {
  it("mutlak tabanın altını reddeder", () => {
    const r = checkPriceFloor(ABSOLUTE_PRICE_FLOOR - 1, null);
    expect(r.ok).toBe(false);
  });

  it("segment medyanının çok altını reddeder (algoritma koruması)", () => {
  
    expect(checkPriceFloor(100_000, 1_000_000).ok).toBe(false);
  });

  it("makul fiyatı kabul eder", () => {
    expect(checkPriceFloor(850_000, 1_000_000).ok).toBe(true);
  });

  it("emsal yoksa yalnızca mutlak taban uygulanır", () => {
    expect(checkPriceFloor(500_000, null).ok).toBe(true);
    expect(checkPriceFloor(5_000, null).ok).toBe(false);
  });

  it("geçersiz fiyatı reddeder", () => {
    expect(checkPriceFloor(0, null).ok).toBe(false);
    expect(checkPriceFloor(NaN, null).ok).toBe(false);
  });
});

describe("median", () => {
  it("tek ve çift eleman", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 2])).toBe(3);
  });
  it("geçersiz/negatif değerleri eler", () => {
    expect(median([0, -5, 100])).toBe(100);
    expect(median([])).toBeNull();
  });
});
