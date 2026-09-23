import { describe, it, expect } from "vitest";
import { arabamBrandSlug } from "./adapters";

describe("arabamBrandSlug", () => {
  it("marka adını Arabam yol-slug'ına çevirir", () => {
    expect(arabamBrandSlug("Lexus")).toBe("lexus");
    expect(arabamBrandSlug("Alfa Romeo")).toBe("alfa-romeo");
    expect(arabamBrandSlug("Mercedes-Benz")).toBe("mercedes-benz");
    expect(arabamBrandSlug("Land Rover")).toBe("land-rover");
    expect(arabamBrandSlug("Rolls-Royce")).toBe("rolls-royce");
    expect(arabamBrandSlug("Tofaş")).toBe("tofas");
  });
});
