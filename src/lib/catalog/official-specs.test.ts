import { describe, it, expect } from "vitest";
import { findOfficialSpec, fuelClassOf, type OfficialSpecEntry } from "./official-specs";

const ENTRY: OfficialSpecEntry = {
  brand: "Renault",
  modelFamily: "Austral",
  horsepower: 150,
  fuelClass: "diger",
  engineLabel: "1.3 mild hybrid 150 hp auto",
  acceleration: 9.9,
  topSpeed: 180,
  torque: 270,
  trunkCapacity: 555,
  fuelTank: "55 L",
  curbWeight: 1654,
  sourceUrl: "https://www.renault.com.tr/hybrid-araclar/renault-austral-2025/teknik-bilgiler.html",
  fetchedAt: "2026-10-29",
};

describe("fuelClassOf", () => {
  it("dizel ve elektrik kesin sınıflanır", () => {
    expect(fuelClassOf("Dizel")).toBe("dizel");
    expect(fuelClassOf("dizel")).toBe("dizel");
    expect(fuelClassOf("Elektrik")).toBe("elektrik");
  });

  it("benzin, hibrit ve LPG aynı gevşek sınıfa düşer (satıcı hafif hibriti çoğu zaman benzin yazar)", () => {
    expect(fuelClassOf("Benzin")).toBe("diger");
    expect(fuelClassOf("Hibrit")).toBe("diger");
    expect(fuelClassOf("LPG & Benzin")).toBe("diger");
    expect(fuelClassOf("benzinli")).toBe("diger");
  });
});

describe("findOfficialSpec", () => {
  it("marka + model ailesi + beygir gücü + yakıt sınıfı eşleşince bulur", () => {
    const found = findOfficialSpec([ENTRY], {
      brand: "Renault",
      model: "Austral",
      title: "Renault Austral 1.3 TCe Icon",
      horsepower: 150,
      fuelType: "Benzin",
    });
    expect(found).toBe(ENTRY);
  });

  it("beygir gücü farklıysa eşleşmez (yanlış nesil/varyanta veri atamaz)", () => {
    const found = findOfficialSpec([ENTRY], {
      brand: "Renault",
      model: "Austral",
      horsepower: 160,
      fuelType: "Benzin",
    });
    expect(found).toBeUndefined();
  });

  it("GLC/CLA gibi marka adı içindeki harflerle yanlışlıkla eşleşmez (kelime sınırı)", () => {
    const found = findOfficialSpec([ENTRY], {
      brand: "Renault",
      model: "Arkana",
      title: "Renault Arkana 1.3 TCe",
      horsepower: 150,
      fuelType: "Benzin",
    });
    expect(found).toBeUndefined();
  });

  it("marka farklıysa eşleşmez", () => {
    const found = findOfficialSpec([ENTRY], {
      brand: "Dacia",
      model: "Austral",
      horsepower: 150,
      fuelType: "Benzin",
    });
    expect(found).toBeUndefined();
  });

  it("dizel girişe benzinli ilan eşleşmez", () => {
    const dieselEntry: OfficialSpecEntry = { ...ENTRY, fuelClass: "dizel" };
    const found = findOfficialSpec([dieselEntry], {
      brand: "Renault",
      model: "Austral",
      horsepower: 150,
      fuelType: "Benzin",
    });
    expect(found).toBeUndefined();
  });

  it("beygir gücü yoksa arama yapılmaz", () => {
    const found = findOfficialSpec([ENTRY], { brand: "Renault", model: "Austral", fuelType: "Benzin" });
    expect(found).toBeUndefined();
  });
});
