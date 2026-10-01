import { describe, expect, it } from "vitest";
import { modelFamilies, modelFamily, modelFamilyKey, modelFamilyRegex } from "./model-family";

describe("modelFamily", () => {
  it("donanımı atıp model adını bırakır", () => {
    expect(modelFamily("Juke 1.0 DIG-T Platinum")).toBe("Juke");
    expect(modelFamily("QASHQAI1.3DIG-TMHEVPLATINUMPR.")).toBe("QASHQAI");
    expect(modelFamily("Passat Variant 1.6 TDI")).toBe("Passat");
    expect(modelFamily("Hilux GR Sport")).toBe("Hilux");
  });

  it("sayı ya da kısa başlangıçta ikinci kelimeyi de alır", () => {
    expect(modelFamily("3 Serisi 320i ED Techno Plus")).toBe("3 Serisi");
    expect(modelFamily("500 X 1.3 Cross")).toBe("500 X");
    expect(modelFamily("R 12 Toros")).toBe("R 12");
    expect(modelFamily("ID. BUZZ PRO KR 210 KW")).toBe("ID. BUZZ");
    expect(modelFamily("ID.4 PURE 125KW")).toBe("ID.4");
    expect(modelFamily("Model Y Long Range AWD")).toBe("Model Y");
    expect(modelFamily("The Beetle 1.2 TSI")).toBe("The Beetle");
  });

  it("harf + 3 haneli sınıfları 'Serisi' ailesinde toplar", () => {
    expect(modelFamily("C 180 AMG")).toBe("C Serisi");
    expect(modelFamily("GLA 200 d AMG")).toBe("GLA Serisi");
    expect(modelFamilyKey("C 200 d")).toBe(modelFamilyKey("C 180 Avantgarde"));
  });

  it("ayrı araç olan ekleri aileye katar", () => {
    expect(modelFamily("Corolla Cross 1.8 Hybrid")).toBe("Corolla Cross");
    expect(modelFamily("Range Rover Evoque 2.0 Si4")).toBe("Range Rover Evoque");
    expect(modelFamily("Range Rover 3.0 SDV8 Vogue")).toBe("Range Rover");
    expect(modelFamily("Discovery Sport 2.0 TD4")).toBe("Discovery Sport");
    expect(modelFamily("Grand Santa Fe 2.2")).toBe("Grand Santa Fe");
    expect(modelFamily("Land Cruiser Prado")).toBe("Land Cruiser");
  });
});

describe("markaya özel aileler", () => {
  it("BMW kodlarını seriye bağlar, X1 gibi adları ayrı tutar", () => {
    expect(modelFamily("320i", "BMW")).toBe("3 Serisi");
    expect(modelFamily("116d", "BMW")).toBe("1 Serisi");
    expect(modelFamily("3 Serisi 320i ED", "BMW")).toBe("3 Serisi");
    expect(modelFamily("X1 sDrive18i", "BMW")).toBe("X1");
    expect(modelFamily("iX xDrive40", "BMW")).toBe("iX");
  });

  it("Mercedes sınıflarını tek ailede toplar", () => {
    for (const m of ["C", "C200", "C 180 AMG", "C-SERISI", "C Serisi", "C 63 AMG"]) {
      expect(modelFamily(m, "Mercedes-Benz")).toBe("C Serisi");
    }
    expect(modelFamily("GLA 200 d", "Mercedes-Benz")).toBe("GLA Serisi");
    expect(modelFamily("Vito Tourer", "Mercedes-Benz")).toBe("Vito");
    expect(modelFamily("GLC 4MATIC", "Mercedes-Benz")).toBe("GLC Serisi");
    expect(modelFamily("AMG GT 43", "Mercedes-Benz")).toBe("AMG");
    expect(modelFamily("I20,I20N,", "Hyundai")).toBe("I20");
    expect(modelFamily("Grande Punto 1.4")).toBe("Grande Punto");
    expect(modelFamilyKey("X TRAIL 1.6 DCI", "Nissan")).toBe(modelFamilyKey("X-Trail 1.6 dCi", "Nissan"));
  });

  it("markaya özel desen tüm yazımları bulur", () => {
    const bmw = modelFamilyRegex("3 Serisi", "BMW");
    expect(["3 Serisi 320i", "3 SERİSİ", "320i", "318I", "X3 20d", "330e"].filter((m) => bmw.test(m))).toEqual(["3 Serisi 320i", "3 SERİSİ", "320i", "318I", "330e"]);
    const merc = modelFamilyRegex("C Serisi", "Mercedes-Benz");
    expect(["C", "C200", "C 180 AMG", "C-SERISI", "CLA 180", "Citan"].filter((m) => merc.test(m))).toEqual(["C", "C200", "C 180 AMG", "C-SERISI"]);
  });
});

describe("modelFamilies", () => {
  it("büyük/küçük harf ve donanım farklarını tek seçenekte toplar", () => {
    expect(modelFamilies(["Juke", "JUKE", "Juke 1.0 DIG-T Platinum", "Juke 1.5 dCi Tekna", "C-hr", "C-HR", "Almera 1.5 Comfort"])).toEqual([
      "Almera",
      "C-hr",
      "Juke",
    ]);
  });
});

describe("modelFamilyRegex", () => {
  const matches = (family: string, models: string[]) => models.filter((m) => modelFamilyRegex(family).test(m));

  it("ailedeki tüm yazımları bulur, benzer adlı başka aracı bulmaz", () => {
    expect(matches("Juke", ["Juke", "JUKE", "Juke 1.0 DIG-T Platinum", "Jukebox", "Qashqai"])).toEqual(["Juke", "JUKE", "Juke 1.0 DIG-T Platinum"]);
    expect(matches("C-HR", ["C-HR 1.8 Hybrid", "C-hr", "CHR", "C 180"])).toEqual(["C-HR 1.8 Hybrid", "C-hr", "CHR"]);
  });

  it("ayrı araç olan kolu dışarıda bırakır", () => {
    expect(matches("Corolla", ["Corolla 1.6", "COROLLA", "Corolla Cross 1.8 Hybrid"])).toEqual(["Corolla 1.6", "COROLLA"]);
    expect(matches("Corolla Cross", ["Corolla 1.6", "Corolla Cross 1.8 Hybrid", "COROLLA CROSS"])).toEqual(["Corolla Cross 1.8 Hybrid", "COROLLA CROSS"]);
    expect(matches("Range Rover", ["Range Rover 3.0 SDV8 Vogue", "Range Rover Evoque 2.0", "RANGE ROVER VELAR"])).toEqual(["Range Rover 3.0 SDV8 Vogue"]);
  });

  it("sınıf ailelerini ve Türkçe harfleri eşleştirir", () => {
    expect(matches("C Serisi", ["C 180 AMG", "C 200 d", "C-Serisi", "CLA 180", "Clio"])).toEqual(["C 180 AMG", "C 200 d", "C-Serisi"]);
    expect(matches("3 Serisi", ["3 Serisi 320i", "3 SERİSİ", "320i"])).toEqual(["3 Serisi 320i", "3 SERİSİ"]);
    expect(matches("Şahin", ["Şahin 1.6", "ŞAHİN", "Sahin"])).toEqual(["Şahin 1.6", "ŞAHİN", "Sahin"]);
  });

  it("aksanlı, bitişik ve işaretli yazımları bulur", () => {
    expect(matches("C-Elysée", ["C-Elysée 1.6 HDi", "C-ELYSEE"])).toEqual(["C-Elysée 1.6 HDi", "C-ELYSEE"]);
    expect(matches("Qashqai", ["QASHQAI1.6DCIX-TRONIC", "Qashqai+2 1.5 dCi"])).toEqual(["QASHQAI1.6DCIX-TRONIC"]);
    expect(matches("Qashqai+2", ["Qashqai+2 1.5 dCi", "Qashqai 1.3"])).toEqual(["Qashqai+2 1.5 dCi"]);
    expect(matches("ID. BUZZ", ["ID. BUZZ PRO KR 210 KW", "ID.4 PURE"])).toEqual(["ID. BUZZ PRO KR 210 KW"]);
    expect(matches("206+", ["206+ 1.4 HDi Envy", "206+", "206 1.6", "2008"])).toEqual(["206+ 1.4 HDi Envy", "206+", "206 1.6"]);
  });

  it("eski bağlantılardaki tam model adıyla da çalışır", () => {
    expect(matches("Juke 1.0 DIG-T Platinum", ["Juke 1.5 dCi", "JUKE"])).toEqual(["Juke 1.5 dCi", "JUKE"]);
  });
});
