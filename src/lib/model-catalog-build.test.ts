import { describe, expect, it } from "vitest";
import { buildModelExtensions, renderModelCatalogData } from "./model-catalog-build";

describe("buildModelExtensions", () => {
  const result = buildModelExtensions([
    { brand: "Hyundai", names: ["i20", "i20 Active", "i20 N", "i20 Troy", "Accent", "Accent Blue", "Ioniq", "Ioniq 6"] },
    { brand: "Hyundai", names: ["Ioniq 5", "Ioniq 5 N", "Kona", "Kona Elektrik"] },
    { brand: "Toyota", names: ["Corolla", "Corolla Cross", "Yaris", "RAV4"] },
  ]);

  it("genel kuralın birleştirdiği ayrı modelleri yazar", () => {
    expect([...result.hyundai].sort()).toEqual(["Accent Blue", "Ioniq 5", "Ioniq 5 N", "Ioniq 6", "Kona Elektrik", "i20 Active", "i20 N", "i20 Troy"].sort());
  });

  it("genel kuralın zaten doğru bulduğu adları yazmaz", () => {
    expect(result.hyundai).not.toContain("i20");
    expect(result.toyota).toBeUndefined(); // "Corolla Cross" genel kuralda zaten ayrı
  });
});

describe("renderModelCatalogData", () => {
  it("içe aktarılabilir bir sabit üretir", () => {
    const text = renderModelCatalogData({ hyundai: ["i20 N"] });
    expect(text).toContain('export const MODEL_EXTENSIONS: Record<string, string[]> = {');
    expect(text).toContain('"hyundai": ["i20 N"],');
  });
});
