import { describe, expect, it } from "vitest";
import { createFamilyMatcher, modelPartOfListingUrl } from "./sitemap-family";

describe("modelPartOfListingUrl", () => {
  it("ilan adresinden marka-model parçasını çıkarır", () => {
    expect(
      modelPartOfListingUrl("https://www.arabam.com/ilan/galeriden-satilik-audi-a7-3-0-tdi/2012-rs7-gorunum-ici/41820924")
    ).toBe("audi-a7-3-0-tdi");
    expect(modelPartOfListingUrl("/ilan/sahibinden-satilik-hyundai-ioniq-6-advance/baslik/42222303")).toBe("hyundai-ioniq-6-advance");
  });

  it("ilan adresi olmayanı ya da satılık öneki olmayanı atlar", () => {
    expect(modelPartOfListingUrl("https://www.arabam.com/ikinci-el/otomobil/audi")).toBeNull();
    expect(modelPartOfListingUrl("/ilan/baska-bir-bicim/baslik/1")).toBeNull();
  });
});

describe("createFamilyMatcher", () => {
  const targets = [
    { id: "audi-a7", slug: "audi-a7", quota: 5 },
    { id: "ioniq", slug: "hyundai-ioniq", quota: 5 },
  ];
  // "hyundai-ioniq-5" hedef değil ama ayrı bir model: "hyundai-ioniq-5-advance" ilanları "Ioniq" ailesine yazılmasın.
  const match = createFamilyMatcher(targets, ["hyundai-ioniq-5", "hyundai-kona", "audi-a6", "audi"]);

  it("hedef ailenin ilanlarını bulur (donanım adı sonda olabilir)", () => {
    expect(match("audi-a7")).toBe("audi-a7");
    expect(match("audi-a7-3-0-tdi-quattro")).toBe("audi-a7");
    expect(match("hyundai-ioniq-hybrid-plug-in")).toBe("ioniq");
  });

  it("daha uzun eşleşen başka modele aitse o ilan hedefe sayılmaz", () => {
    expect(match("hyundai-ioniq-5-advance")).toBeNull();
    expect(match("audi-a6-sedan-3-0-tdi")).toBeNull();
  });

  it("adın yalnızca öneki olan farklı modeli eşlemez", () => {
    expect(match("audi-a70")).toBeNull();
    expect(match("hyundai-ioniq6")).toBeNull();
  });

  it("hedefi olmayan markaya hiç bakmaz", () => {
    expect(match("renault-clio-1-5-dci")).toBeNull();
  });
});
