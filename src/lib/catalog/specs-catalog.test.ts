import { describe, it, expect } from "vitest";
import { resolveTechnicalSpecs, estimateSpecsFromDynamics } from "./specs-catalog";

describe("specs-catalog", () => {
  it("resolves exact factory specs for Porsche Macan Turbo Electric", () => {
    const specs = resolveTechnicalSpecs({
      brand: "Porsche",
      model: "Macan Turbo Electric",
      title: "VOSMER 2025 PORSCHE MACAN TURBO ELEKTRİK 639 HP 4X4",
      year: 2025,
      features: { horsepower: 639, fuelType: "Elektrik" },
    });

    expect(specs.acceleration).toBe(3.3);
    expect(specs.topSpeed).toBe(260);
    expect(specs.torque).toBe(1130);
    expect(specs.trunkCapacity).toBe(540);
    expect(specs.fuelTank).toBe("100 kWh");
    expect(specs.specSource).toBe("catalog");
  });

  it("resolves exact factory specs for Mercedes-Benz EQS 580", () => {
    const specs = resolveTechnicalSpecs({
      brand: "Mercedes-Benz",
      model: "EQS 580 Heritage Edition",
      title: "Sahibinden Mercedes - Benz EQS 580 Heritage Edition 2023 Model",
      year: 2023,
      features: { horsepower: 544, fuelType: "Elektrik" },
    });

    expect(specs.acceleration).toBe(4.3);
    expect(specs.topSpeed).toBe(210);
    expect(specs.torque).toBe(858);
    expect(specs.trunkCapacity).toBe(610);
    expect(specs.fuelTank).toBe("108.4 kWh");
    expect(specs.specSource).toBe("catalog");
  });

  it("resolves exact factory specs for older Ford Tourneo Connect (2002-2013)", () => {
    const specs = resolveTechnicalSpecs({
      brand: "Ford",
      model: "Tourneo Connect 1.8 TDCI GLX",
      title: "Sahibinden Ford Tourneo Connect 1.8 TDCI GLX 2009 Model",
      year: 2009,
      features: { horsepower: 110, fuelType: "Dizel" },
    });

    expect(specs.acceleration).toBe(13.5);
    expect(specs.topSpeed).toBe(164);
    expect(specs.torque).toBe(250);
    expect(specs.trunkCapacity).toBe(1200);
    expect(specs.fuelTank).toBe("60 L");
    expect(specs.specSource).toBe("catalog");
  });

  it("prioritizes listing explicit values when provided", () => {
    const specs = resolveTechnicalSpecs({
      brand: "Renault",
      model: "Megane",
      year: 2022,
      features: {
        acceleration: 9.0,
        topSpeed: 210,
        torque: 260,
        fuelTank: "50 L",
      },
    });

    expect(specs.acceleration).toBe(9.0);
    expect(specs.topSpeed).toBe(210);
    expect(specs.torque).toBe(260);
    expect(specs.specSource).toBe("listing");
  });

  it("estimates realistic dynamic specs for unlisted models", () => {
    const specs = estimateSpecsFromDynamics({
      brand: "Maserati",
      model: "Ghibli",
      year: 2021,
      horsepower: 350,
      bodyType: "Sedan",
      fuelType: "Benzin",
    });

    expect(specs.acceleration).toBeGreaterThan(3.5);
    expect(specs.acceleration).toBeLessThan(7.0);
    expect(specs.topSpeed).toBeGreaterThan(230);
    expect(specs.torque).toBeGreaterThan(400);
    expect(specs.trunkCapacity).toBe(500);
    expect(specs.specSource).toBe("derived");
  });
});

