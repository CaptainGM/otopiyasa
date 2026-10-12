import { describe, expect, it } from "vitest";
import { cleanCarTerm } from "./chatbot";

describe("cleanCarTerm", () => {
  it("genel araç sözcüklerini marka saymaz", () => {
    expect(cleanCarTerm("arac hangisi")).toBe("");
    expect(cleanCarTerm("araç")).toBe("");
    expect(cleanCarTerm("ARABA")).toBe("");
  });

  it("marka ve modeli korur", () => {
    expect(cleanCarTerm("BMW 5 Serisi")).toBe("BMW 5 Serisi");
    expect(cleanCarTerm("porsche hangisi")).toBe("porsche");
    expect(cleanCarTerm("Mercedes-Benz araç")).toBe("Mercedes-Benz");
  });
});
