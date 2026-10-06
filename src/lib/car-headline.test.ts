import { describe, expect, it } from "vitest";
import { carHeadline, tidyCaps } from "./car-headline";

describe("tidyCaps", () => {
  it("büyük harfli model adlarını düzeltir", () => {
    expect(tidyCaps("SPORTAGE")).toBe("Sportage");
    expect(tidyCaps("GOLF 1.6 TDI")).toBe("Golf 1.6 TDI");
    expect(tidyCaps("DOBLO COMBI TREKKING")).toBe("Doblo Combi Trekking");
    expect(tidyCaps("Panamera 4S E-HYBRID")).toBe("Panamera 4S E-Hybrid");
  });

  it("motor kodlarına ve kısaltmalara dokunmaz", () => {
    expect(tidyCaps("Focus 1.5 TDCI")).toBe("Focus 1.5 TDCI");
    expect(tidyCaps("A3 1.4 TFSI")).toBe("A3 1.4 TFSI");
    expect(tidyCaps("C 200 D AMG")).toBe("C 200 D AMG");
    expect(tidyCaps("X5 xDrive")).toBe("X5 xDrive");
  });
});

describe("carHeadline", () => {
  it("marka + model, model markayla başlıyorsa tekrar etmez", () => {
    expect(carHeadline({ title: "x", brand: "Kia", model: "SPORTAGE" })).toBe("Kia Sportage");
    expect(carHeadline({ title: "x", brand: "Fiat", model: "Fiat Egea" })).toBe("Fiat Egea");
  });

  it("marka/model yoksa ilan başlığı", () => {
    expect(carHeadline({ title: "2016 OPEL İNSİGNİA" })).toBe("2016 OPEL İNSİGNİA");
  });
});
