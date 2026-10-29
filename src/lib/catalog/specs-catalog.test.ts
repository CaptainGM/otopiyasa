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

  it("does not map GLC, CLA, CLS or EQE listings onto C-Class or E-Class rows", () => {
    const glc = resolveTechnicalSpecs({ brand: "Mercedes-Benz", model: "GLC", title: "Mercedes-Benz GLC 200 AMG", year: 2022 });
    expect(glc.specSource).toBe("catalog");
    expect(glc.trunkCapacity).toBe(620);

    const cla = resolveTechnicalSpecs({ brand: "Mercedes-Benz", model: "CLA", title: "Mercedes-Benz CLA 180", year: 2020 });
    expect(cla.specSource).toBe("derived");

    const cls = resolveTechnicalSpecs({ brand: "Mercedes-Benz", model: "CLS", title: "Mercedes-Benz CLS 200", year: 2022 });
    expect(cls.specSource).toBe("derived");

    const eqe = resolveTechnicalSpecs({ brand: "Mercedes-Benz", model: "EQE", title: "Mercedes-Benz EQE 200", year: 2023 });
    expect(eqe.specSource).toBe("derived");
  });

  it("keeps A 180, E 200 and C 200 on their own factory rows, including when the model field holds only the family letter", () => {
    const a180 = resolveTechnicalSpecs({ brand: "Mercedes-Benz", model: "A", title: "Mercedes-Benz A 180 Style", year: 2020 });
    expect(a180.acceleration).toBe(8.8);
    expect(a180.trunkCapacity).toBe(370);

    const e200 = resolveTechnicalSpecs({ brand: "Mercedes-Benz", model: "E", title: "Mercedes-Benz E 200 Exclusive", year: 2019 });
    expect(e200.acceleration).toBe(7.5);
    expect(e200.trunkCapacity).toBe(540);

    const c200 = resolveTechnicalSpecs({ brand: "Mercedes-Benz", model: "C", title: "Mercedes-Benz C 200 AMG", year: 2022 });
    expect(c200.acceleration).toBe(7.1);

    const numericModel = resolveTechnicalSpecs({ brand: "Mercedes-Benz", model: "200", title: "Mercedes-Benz C 200 Avantgarde", year: 2022 });
    expect(numericModel.acceleration).toBe(7.1);
  });

  it("does not invent trunk or fuel values when the listing only carries performance fields", () => {
    const specs = resolveTechnicalSpecs({
      brand: "Maserati",
      model: "Ghibli",
      year: 2021,
      features: { acceleration: 5.1, topSpeed: 280, torque: 600 },
    });

    expect(specs.specSource).toBe("listing");
    expect(specs.trunkCapacity).toBeUndefined();
    expect(specs.fuelTank).toBeUndefined();
  });

  it("normalizes listing fuel tank units to liters", () => {
    const specs = resolveTechnicalSpecs({
      brand: "Renault",
      model: "Megane",
      year: 2022,
      features: { acceleration: 9.0, topSpeed: 210, torque: 260, fuelTank: "50 lt" },
    });

    expect(specs.fuelTank).toBe("50 L");
  });

  it("keeps diesel and CDI spellings on their factory rows", () => {
    const c200d = resolveTechnicalSpecs({ brand: "Mercedes-Benz", model: "C", title: "Mercedes-Benz C200d AMG", year: 2022 });
    expect(c200d.acceleration).toBe(7.1);

    const e220Cdi = resolveTechnicalSpecs({ brand: "Mercedes-Benz", model: "E", title: "Mercedes-Benz E 220 CDI Avantgarde", year: 2019 });
    expect(e220Cdi.acceleration).toBe(7.3);
  });

  it("önceliği doğrular: web (resmi kaynak) > catalog (elle girilmiş) > derived (tahmin)", () => {
    // Renault Austral hem official-specs-data.ts'de (150 hp, beygir eşleşirse) hem CATALOG_DATABASE'de (beygirsiz, her zaman
    // eşleşir) var; aynı beygirle web verisi kazanmalı, catalog'un sabit değerleri dönmemeli.
    const web = resolveTechnicalSpecs({
      brand: "Renault",
      model: "Austral",
      title: "Renault Austral 1.3 TCe Icon",
      year: 2024,
      features: { horsepower: 150, fuelType: "Benzin" },
    });
    expect(web.specSource).toBe("web");
    expect(web.sourceUrl).toBeTruthy();
    expect(web.trunkCapacity).toBe(555); // official-specs-data.ts değeri; catalog'un sabiti 500

    // Beygir uyuşmazsa web eşleşmez, catalog'a düşer (yıl aralığı yok, beygirsiz her zaman eşleşir).
    const catalog = resolveTechnicalSpecs({
      brand: "Renault",
      model: "Austral",
      title: "Renault Austral 1.3 TCe Icon",
      year: 2024,
      features: { horsepower: 999, fuelType: "Benzin" },
    });
    expect(catalog.specSource).toBe("catalog");
    expect(catalog.trunkCapacity).toBe(500);

    // Hem web hem catalogda hiç karşılığı olmayan marka/model: tahmine düşer.
    const derived = resolveTechnicalSpecs({
      brand: "BYD",
      model: "Seal U",
      year: 2025,
      features: { horsepower: 218, fuelType: "Elektrik" },
    });
    expect(derived.specSource).toBe("derived");
  });
});

