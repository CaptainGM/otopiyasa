import { describe, expect, it } from "vitest";
import { verifiedCityUpdate } from "./city-merge";

describe("verifiedCityUpdate", () => {
  it("does not replace a saved city with a guessed or missing value", () => {
    expect(verifiedCityUpdate("Ankara", "İstanbul", false)).toBeUndefined();
    expect(verifiedCityUpdate("Ankara", "İstanbul")).toBeUndefined();
    expect(verifiedCityUpdate("Ankara", "Türkiye")).toBeUndefined();
    expect(verifiedCityUpdate("Ankara", "Bilinmiyor")).toBeUndefined();
    expect(verifiedCityUpdate("Ankara", "Belirtilmemiş", true)).toBeUndefined();
  });

  it("accepts a real changed city and skips an unchanged one", () => {
    expect(verifiedCityUpdate("Ankara", "Bursa", true)).toBe("Bursa");
    expect(verifiedCityUpdate("Bursa", "Bursa", true)).toBeUndefined();
  });
});
