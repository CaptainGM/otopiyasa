import { describe, it, expect } from "vitest";
import {
  deriveColor,
  deriveEngineSize,
  deriveDrivetrain,
  enrichFeatures,
} from "./derive-specs";
import { CarFeatures } from "@/types";

describe("deriveColor", () => {
  it("başlık sonundaki rengi yakalar", () => {
    expect(deriveColor("Galeriden Audi A6 2025 Model Ankara 6.030 km Siyah")).toBe("Siyah");
  });
  it("çok kelimeli rengi tek kelimeden önce seçer", () => {
    expect(deriveColor("VW Passat Gümüş Gri metalik")).toBe("Gümüş Gri");
  });
  it("renk yoksa undefined döner", () => {
    expect(deriveColor("Fiat Egea 2023 Model İstanbul")).toBeUndefined();
  });
});

describe("deriveEngineSize", () => {
  it("başlıktaki motor hacmini çıkarır", () => {
    expect(deriveEngineSize("Volkswagen Polo 1.0 TSI 95 DSG Life")).toBe(1.0);
    expect(deriveEngineSize("BMW 320d 2.0 Dizel")).toBe(2.0);
  });
  it("kilometre/fiyat gibi binlik ayraçlı sayıları motor sanmaz", () => {
    expect(deriveEngineSize("Audi A6 Ankara 6.030 km")).toBeUndefined();
    expect(deriveEngineSize("Fiat Egea 1.395.000 TL")).toBeUndefined();
  });
  it("motor bilgisi yoksa undefined döner", () => {
    expect(deriveEngineSize("Tesla Model 3 Ankara")).toBeUndefined();
  });
});

describe("deriveDrivetrain", () => {
  it("kesin 4x4 ibarelerini yakalar", () => {
    expect(deriveDrivetrain("Audi A6 40 TDI Quattro")).toBe("4x4");
    expect(deriveDrivetrain("BMW X5 xDrive")).toBe("4x4");
    expect(deriveDrivetrain("Mercedes 4Matic")).toBe("4x4");
  });
  it("belirsizse undefined döner (önden/arkadan uydurulmaz)", () => {
    expect(deriveDrivetrain("Renault Clio 1.0")).toBeUndefined();
  });
});

describe("enrichFeatures", () => {
  const base: CarFeatures = {
    fuelType: "Benzin",
    transmission: "Otomatik",
    bodyType: "Sedan",
    color: "Belirtilmemiş",
  };

  it("boş rengi başlıktan doldurur, var olanı ezmez", () => {
    const out = enrichFeatures(base, "Audi A6 Siyah");
    expect(out.color).toBe("Siyah");

    const existing = enrichFeatures({ ...base, color: "Beyaz" }, "Audi A6 Siyah");
    expect(existing.color).toBe("Beyaz"); 
  });

  it("boş motor/çekiş türetilir", () => {
    const out = enrichFeatures(base, "VW Golf 1.4 TSI Quattro");
    expect(out.engineSize).toBe(1.4);
    expect(out.drivetrain).toBe("4x4");
  });
});
