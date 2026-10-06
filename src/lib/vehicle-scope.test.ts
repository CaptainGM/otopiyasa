import { describe, expect, it } from "vitest";
import { outOfScopeBodyType, outOfScopeReason } from "./vehicle-scope";

describe("outOfScopeReason", () => {
  it("otomobil, SUV ve hafif ticari arabaları kapsamda tutar", () => {
    for (const [brand, model, bodyType] of [
      ["Fiat", "Doblo Combi 1.3 Multijet", "MPV"],
      ["Fiat", "Doblo Cargo 1.3 Multijet Maxi", "Panelvan"],
      ["Citroen", "Berlingo 1.6 HDi", "Kombi"],
      ["Volkswagen", "Caddy", "Camlı Van"],
      ["Ford", "Tourneo Courier", "Minivan"],
      ["Mitsubishi", "L 300", "Panelvan"],
      ["Toyota", "Corolla", "Sedan"],
      ["Dacia", "Duster", "SUV"],
      ["Honda", "Civic", "Sedan"],
      ["Honda", "CR-V", "SUV"],
      ["BMW", "X5", "SUV"],
      ["Mercedes-Benz", "Vito", "Minivan"],
      ["Suzuki", "Vitara", "SUV"],
    ]) {
      expect(outOfScopeReason({ brand, model, bodyType }), `${brand} ${model}`).toBeNull();
    }
  });

  it("pickup'ları eler", () => {
    expect(outOfScopeReason({ brand: "Toyota", model: "Hilux 2.4 D-4D" })).toBe("pickup");
    expect(outOfScopeReason({ brand: "Ford", model: "Ranger 2.0 EcoBlue Wildtrak" })).toBe("pickup");
    expect(outOfScopeReason({ brand: "Mitsubishi", model: "L 200 2.4 Double Cab" })).toBe("pickup");
    expect(outOfScopeReason({ brand: "Nissan", model: "Navara" })).toBe("pickup");
    expect(outOfScopeReason({ brand: "Isuzu", model: "D-Max" })).toBe("pickup / kamyonet");
    expect(outOfScopeReason({ brand: "Volkswagen", model: "Amarok" })).toBe("pickup");
    // Kaynak kasa tipini yazıyorsa model listesinde olmasa da elenir.
    expect(outOfScopeReason({ brand: "Bilinmeyen", model: "X", bodyType: "Pick-up" })).toBe("pickup");
  });

  it("kamyon, otobüs, kamyonet ve minibüsleri eler", () => {
    expect(outOfScopeReason({ brand: "Mercedes-Benz", model: "Axor 2521" })).toBe("kamyon / otobüs");
    expect(outOfScopeReason({ brand: "Ford Trucks", model: "Cargo" })).toBe("kamyon / otobüs");
    expect(outOfScopeReason({ brand: "Iveco-Otoyol", model: "35" })).toBe("kamyon / otobüs");
    expect(outOfScopeReason({ brand: "Ford", model: "Transit", bodyType: "Şasi kabin" })).toBe("kamyon / kamyonet");
    expect(outOfScopeReason({ brand: "Volkswagen", model: "Crafter", bodyType: "Minibüs" })).toBe("otobüs / minibüs");
  });

  it("motosiklet, scooter, ATV ve karavanları eler", () => {
    expect(outOfScopeReason({ brand: "Yamaha", model: "X-Max 250 ABS" })).toBe("motosiklet / ATV");
    expect(outOfScopeReason({ brand: "Honda", model: "Activa 125" })).toBe("motosiklet");
    expect(outOfScopeReason({ brand: "BMW", model: "R 1250 GS" })).toBe("motosiklet");
    expect(outOfScopeReason({ brand: "Sahibinden", model: "Karavan Motokaravan" })).toBe("araç ilanı değil");
    expect(outOfScopeReason({ brand: "Galeriden", model: "ATV &" })).toBe("araç ilanı değil");
  });
});

describe("outOfScopeBodyType", () => {
  it("panelvan ve minivanı kapsam içinde sayar", () => {
    expect(outOfScopeBodyType("Panelvan")).toBeNull();
    expect(outOfScopeBodyType("Minivan / Van")).toBeNull();
    expect(outOfScopeBodyType("Kombi")).toBeNull();
    expect(outOfScopeBodyType("yandan yüklemeli kasa")).toBe("kamyon / kamyonet");
  });
});
