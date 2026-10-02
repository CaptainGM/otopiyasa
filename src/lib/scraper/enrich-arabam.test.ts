import { describe, expect, it } from "vitest";
import { arabamDetailSet } from "./enrich-arabam";
import type { ScrapedListing } from "./types";

const listing = (features: Partial<ScrapedListing["features"]>) =>
  ({ description: "", images: [], features: { fuelType: "", transmission: "", bodyType: "", color: "", ...features } }) as unknown as ScrapedListing;

describe("arabamDetailSet", () => {
  it("liste sayfasındaki yakıt/vites tahminini ilan sayfasındaki değerle düzeltir", () => {
    const set = arabamDetailSet(listing({ fuelType: "Dizel", transmission: "Otomatik" }), {
      _id: "x",
      features: { fuelType: "Benzin", transmission: "Manuel" },
    });
    expect(set["features.fuelType"]).toBe("Dizel");
    expect(set["features.transmission"]).toBe("Otomatik");
  });

  it("sonradan takılan LPG'yi ve bilinmeyen değeri ezmez", () => {
    const set = arabamDetailSet(listing({ fuelType: "Benzin", transmission: "" }), {
      _id: "x",
      features: { fuelType: "LPG & Benzin", transmission: "Manuel" },
    });
    expect(set["features.fuelType"]).toBeUndefined();
    expect(set["features.transmission"]).toBeUndefined();
  });
});
