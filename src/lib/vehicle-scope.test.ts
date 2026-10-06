import { describe, expect, it } from "vitest";
import { classFromBodyType, classFromSourceCategory, outOfScopeReason, vehicleClassOf } from "./vehicle-scope";

describe("outOfScopeReason", () => {
  it("yalnızca ATV/UTV, deniz/hava, kiralık ve araç olmayan ilanları dışarıda bırakır", () => {
    expect(outOfScopeReason({ sourceCategory: "atv" })).not.toBeNull();
    expect(outOfScopeReason({ sourceCategory: "utv/can-am" })).not.toBeNull();
    expect(outOfScopeReason({ sourceCategory: "deniz-araclari" })).not.toBeNull();
    expect(outOfScopeReason({ sourceCategory: "kiralik-araclar" })).not.toBeNull();
    expect(outOfScopeReason({ sourceCategory: "ticari-araclar-hat-plaka" })).not.toBeNull();
    expect(outOfScopeReason({ brand: "Galeriden", model: "ATV &" })).toBe("araç ilanı değil");
    expect(outOfScopeReason({ brand: "Polaris", model: "Sportsman 570" })).toBe("ATV / UTV");
    expect(outOfScopeReason({ brand: "Sahibinden", model: "Ticari Araçlar", title: "Sahibinden Ticari Araçlar Hat & Plaka Taksi Plakası" })).toBe("araç ilanı değil");
  });

  it("motosiklet, pickup, kamyon, minibüs ve karavanı kapsamda tutar", () => {
    for (const input of [
      { brand: "Yamaha", model: "X-Max 250" },
      { brand: "Toyota", model: "Hilux" },
      { brand: "Mercedes-Benz", model: "Axor 2521" },
      { brand: "Volkswagen", model: "Caravelle", bodyType: "Minibüs" },
      { brand: "Ford", model: "Transit", bodyType: "Şasi kabin" },
      { brand: "Sahibinden", model: "Karavan Motokaravan" },
      { sourceCategory: "motosiklet/yamaha" },
      { sourceCategory: "ticari-araclar" },
    ]) {
      expect(outOfScopeReason(input), JSON.stringify(input)).toBeNull();
    }
  });
});

describe("vehicleClassOf", () => {
  it("önce kaynağın kategorisini kullanır", () => {
    expect(vehicleClassOf({ sourceCategory: "arazi-suv-pick-up/toyota-hilux", brand: "Toyota", model: "Hilux" })).toBe("suv-pickup");
    expect(vehicleClassOf({ sourceCategory: "motosiklet/honda", brand: "Honda", model: "Civic" })).toBe("motosiklet");
    expect(vehicleClassOf({ sourceCategory: "minivan-panelvan/fiat-doblo", brand: "Fiat", model: "Doblo" })).toBe("minivan-panelvan");
  });

  it("kategori yoksa marka, model ve kasadan çıkarır", () => {
    expect(vehicleClassOf({ brand: "Yamaha", model: "X-Max 250 ABS" })).toBe("motosiklet");
    expect(vehicleClassOf({ brand: "Honda", model: "Activa 125" })).toBe("motosiklet");
    expect(vehicleClassOf({ brand: "Honda", model: "Civic", bodyType: "Sedan" })).toBe("otomobil");
    expect(vehicleClassOf({ brand: "Mitsubishi", model: "L 200 2.4" })).toBe("suv-pickup");
    expect(vehicleClassOf({ brand: "Mitsubishi", model: "L 300", bodyType: "Panelvan" })).toBe("minivan-panelvan");
    expect(vehicleClassOf({ brand: "Iveco-Otoyol", model: "35" })).toBe("ticari");
    expect(vehicleClassOf({ brand: "Ford", model: "Transit", bodyType: "yandan yüklemeli kasa" })).toBe("ticari");
    expect(vehicleClassOf({ brand: "Dacia", model: "Duster", bodyType: "SUV" })).toBe("suv-pickup");
    expect(vehicleClassOf({ brand: "Fiat", model: "Egea", bodyType: "Belirtilmemiş" })).toBe("otomobil");
    expect(vehicleClassOf({ brand: "Sahibinden", model: "Karavan Motokaravan" })).toBe("karavan");
  });
});

describe("classFromSourceCategory / classFromBodyType", () => {
  it("kaynak yazımlarını eşler", () => {
    expect(classFromSourceCategory("otomobil")).toBe("otomobil");
    expect(classFromSourceCategory("karavan-motokaravan")).toBe("karavan");
    expect(classFromSourceCategory("")).toBeNull();
    expect(classFromBodyType("Pick-up")).toBe("suv-pickup");
    expect(classFromBodyType("Minibüs")).toBe("ticari");
    expect(classFromBodyType("Hatchback/5")).toBeNull();
  });
});

describe("vehicleClassOf hafif ticari", () => {
  it("kasa tipi bilinmese de Doblo, Caddy, Berlingo gibi araçları minivan & panelvan sayar", () => {
    expect(vehicleClassOf({ brand: "Fiat", model: "Doblo Combi 1.3 Multijet", bodyType: "Belirtilmemiş" })).toBe("minivan-panelvan");
    expect(vehicleClassOf({ brand: "Volkswagen", model: "Caddy" })).toBe("minivan-panelvan");
    expect(vehicleClassOf({ brand: "Ford", model: "Tourneo Courier" })).toBe("minivan-panelvan");
    expect(vehicleClassOf({ brand: "Mercedes-Benz", model: "Vito 114 CDI" })).toBe("minivan-panelvan");
    // Kaynak kategorisi her zaman önce gelir.
    expect(vehicleClassOf({ brand: "Fiat", model: "Doblo", sourceCategory: "otomobil" })).toBe("otomobil");
  });
});
