import { describe, expect, it } from "vitest";
import { dodExternalIdFromUrl, dodRedirectLostListingId, normalizeDodUrl } from "./dod";

describe("DOD ilan adresleri", () => {
  it("ilan numarasını çıkarır ve XML adresini normalleştirir", () => {
    expect(dodExternalIdFromUrl("https://dod.com.tr/arac-detay/ford-focus-123456")).toBe("dod-123456");
    expect(normalizeDodUrl("https://www.dod.com.tr/arac-detay/a&amp;b-123456")).toBe("https://dod.com.tr/arac-detay/a&b-123456");
  });

  it("ilan numarası kaybolan içerik yönlendirmesini kaldırılmış sayar", () => {
    expect(dodRedirectLostListingId(
      "https://dod.com.tr/arac-detay/ford-focus-123456",
      "https://dod.com.tr/ikinci-el/ford-focus"
    )).toBe(true);
  });

  it("ana sayfa, alan adı normalleştirmesi ve aynı ilan adresi kanıt sayılmaz", () => {
    const original = "https://www.dod.com.tr/arac-detay/ford-focus-123456";
    expect(dodRedirectLostListingId(original, "https://dod.com.tr/")).toBe(false);
    expect(dodRedirectLostListingId(original, "https://dod.com.tr/arac-detay/ford-focus-123456")).toBe(false);
  });
});
