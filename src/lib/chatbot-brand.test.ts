import { describe, expect, it } from "vitest";
import { brandModelFilter, splitBrandModel } from "./chatbot";

describe("splitBrandModel", () => {
  it("çok kelimeli model adını markadan ayırır", () => {
    expect(splitBrandModel("BMW 5 Serisi")).toEqual({ brand: "BMW", model: "5 Serisi" });
    expect(splitBrandModel("Volkswagen Golf")).toEqual({ brand: "Volkswagen", model: "Golf" });
  });

  it("tek kelimede model yoktur", () => {
    expect(splitBrandModel("Toyota")).toEqual({ brand: "Toyota", model: undefined });
  });

  it("çok kelimeli marka adlarını bölmez", () => {
    expect(splitBrandModel("Mercedes-Benz C Serisi")).toEqual({ brand: "Mercedes-Benz", model: "C Serisi" });
    expect(splitBrandModel("Land Rover Defender")).toEqual({ brand: "Land Rover", model: "Defender" });
  });
});

describe("brandModelFilter", () => {
  it("model varsa marka ve model ailesini birlikte arar", () => {
    const filter = brandModelFilter("BMW 5 Serisi") as any;
    expect(filter.brand.$regex).toBeTruthy();
    expect(filter.model).toBeInstanceOf(RegExp);
    expect(filter.model.test("5 SERISI")).toBe(true);
  });

  it("yalnızca marka varsa model koşulu eklenmez", () => {
    expect(brandModelFilter("Toyota").model).toBeUndefined();
  });
});
