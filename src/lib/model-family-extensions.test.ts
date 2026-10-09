import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/model-catalog-data", () => ({
  MODEL_EXTENSIONS: {
    hyundai: ["i20 N", "i20 Active", "i20 Troy", "Ioniq 5", "Ioniq 5 N", "Ioniq 6", "Accent Blue"],
  },
}));

import { genericModelFamily, modelFamily, modelFamilyKey, modelFamilyRegex, modelFamilies } from "./model-family";

describe("kaynağın ayrı model saydığı adlar", () => {
  it("i20 N ayrı model olur, düz i20 ve donanımlı yazımlar i20'de kalır", () => {
    expect(modelFamily("i20 N", "Hyundai")).toBe("i20 N");
    expect(modelFamily("i20 N 1.6 T-GDI (204)", "Hyundai")).toBe("i20 N");
    expect(modelFamily("I20N", "Hyundai")).toBe("I20N".length ? modelFamily("i20 N", "Hyundai") : "");
    expect(modelFamily("i20", "Hyundai")).toBe("i20");
    expect(modelFamily("i20 1.4 MPI Jump", "Hyundai")).toBe("i20");
    expect(modelFamily("i20 Active 1.4", "Hyundai")).toBe("i20 Active");
  });

  it("Ioniq 5, Ioniq 5 N ve Ioniq 6 ayrı; uzun ad önce eşleşir", () => {
    expect(modelFamily("Ioniq 5 N", "Hyundai")).toBe("Ioniq 5 N");
    expect(modelFamily("Ioniq 5 Dynamic Vision Roof", "Hyundai")).toBe("Ioniq 5");
    expect(modelFamily("Ioniq 6", "Hyundai")).toBe("Ioniq 6");
    expect(modelFamily("Ioniq", "Hyundai")).toBe("Ioniq");
  });

  it("başka markada aynı ad etkilenmez", () => {
    expect(modelFamily("i20 N", "Fiat")).toBe("i20");
  });

  it("genel kural kaynak listesi olmadan çalışır", () => {
    expect(genericModelFamily("i20 N", "Hyundai")).toBe("i20");
  });

  it("aile anahtarı ve liste ayrı modelleri ayrı tutar", () => {
    expect(modelFamilyKey("i20 N", "Hyundai")).not.toBe(modelFamilyKey("i20", "Hyundai"));
    expect(modelFamilies(["i20", "i20 N 1.6", "i20 1.4 Jump", "i20 Active"], "Hyundai")).toEqual(["i20", "i20 Active", "i20 N"]);
  });

  it("i20 deseni i20 N'i bulmaz, i20 N deseni yalnız i20 N'i bulur", () => {
    const plain = modelFamilyRegex("i20", "Hyundai");
    const n = modelFamilyRegex("i20 N", "Hyundai");
    expect(plain.test("i20")).toBe(true);
    expect(plain.test("I20 1.4 MPI Style")).toBe(true);
    expect(plain.test("I20, I20N, BAYON")).toBe(true);
    expect(plain.test("i20 N")).toBe(false);
    expect(plain.test("i20 N 1.6 T-GDI")).toBe(false);
    expect(plain.test("i20 Active")).toBe(false);
    expect(plain.test("i20 Troy 1.4")).toBe(false);
    expect(n.test("i20 N")).toBe(true);
    expect(n.test("I20N 1.6")).toBe(true);
    expect(n.test("i20 1.4 MPI")).toBe(false);
  });

  it("Ioniq deseni 5 ve 6'yı dışarıda bırakır", () => {
    const base = modelFamilyRegex("Ioniq", "Hyundai");
    const five = modelFamilyRegex("Ioniq 5", "Hyundai");
    expect(base.test("Ioniq Hybrid")).toBe(true);
    expect(base.test("Ioniq 5")).toBe(false);
    expect(base.test("Ioniq 6")).toBe(false);
    expect(five.test("Ioniq 5 Progressive")).toBe(true);
    expect(five.test("Ioniq 5 N")).toBe(false);
  });
});
