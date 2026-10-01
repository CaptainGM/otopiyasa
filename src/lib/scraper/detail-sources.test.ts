import { describe, expect, it } from "vitest";
import {
  carvakPartName,
  normalizePartState,
  parseCarvakDynamic,
  parseDodDetail,
  parseOtomerkeziDetail,
  summarizeParts,
} from "./detail-sources";

describe("carvakPartName", () => {
  it("parça kodunu hasar şemasının Türkçe adına çevirir", () => {
    expect(carvakPartName("frontBumper")).toBe("Ön Tampon");
    expect(carvakPartName("backBumper")).toBe("Arka Tampon");
    expect(carvakPartName("leftFrontDoor")).toBe("Sol Ön Kapı");
    expect(carvakPartName("rightBackFender")).toBe("Sağ Arka Çamurluk");
    expect(carvakPartName("hood")).toBe("Motor Kaputu");
    expect(carvakPartName("trunk")).toBe("Bagaj Kapağı");
    expect(carvakPartName("rightPillarA")).toBe("Sağ A Direği");
    expect(carvakPartName("somethingNew")).toBe("somethingNew");
  });
});

describe("normalizePartState / summarizeParts", () => {
  it("kaynakların durum kodlarını tek sözlüğe çevirir", () => {
    expect(normalizePartState("painted")).toBe("Boyanmış");
    expect(normalizePartState("local_painted")).toBe("Lokal Boyanmış");
    expect(normalizePartState("modified")).toBe("Değişmiş");
    expect(normalizePartState("ok")).toBe("Orijinal");
    expect(normalizePartState("original")).toBe("Orijinal");
    expect(normalizePartState("")).toBeNull();
  });

  it("özet üretir", () => {
    expect(summarizeParts([{ name: "a", state: "Değişmiş" }, { name: "b", state: "Boyanmış" }, { name: "c", state: "Boyanmış" }])).toBe("1 değişen, 2 boyalı");
    expect(summarizeParts([{ name: "a", state: "Orijinal" }])).toBe("Boya/değişen yok");
  });
});

describe("parseCarvakDynamic", () => {
  // Canlı yanıtın yapısı (2026-10), kısaltılmış.
  const json = {
    data: { mainResult: { car_id: 541137, car_make: "BMW", car_model: "5 Serisi", car_trim: "520d", car_year: 2022, ext_color: "Siyah", body_type: "Sedan", transmission: "Otomatik", fuel_type: "Dizel" } },
    media: { gallery: { images: ["https://img.carvak.co/a.jpg", "https://img.carvak.co/b.jpg", "https://img.carvak.co/a.jpg"] } },
    features: { types: [{ items: [{ code: "performance.max_power_hp", value: "190" }, { code: "engine.liters", value: "2.0" }] }] },
    dimples: {
      parts: [
        { partCode: "frontBumper", statusCode: "painted" },
        { partCode: "hood", statusCode: "original" },
        { partCode: "leftFrontDoor", statusCode: "modified" },
      ],
      accidents: [{ amount: "₺56131", date: "25.04.2022", type: "ERP-Carpma" }],
    },
  };

  it("galeri, parça durumları, tramer ve teknik bilgiyi okur", () => {
    const d = parseCarvakDynamic(json)!;
    expect(d.images).toEqual(["https://img.carvak.co/a.jpg", "https://img.carvak.co/b.jpg"]);
    expect(d.damageParts).toEqual([
      { name: "Ön Tampon", state: "Boyanmış" },
      { name: "Motor Kaputu", state: "Orijinal" },
      { name: "Sol Ön Kapı", state: "Değişmiş" },
    ]);
    expect(d.paintChange).toBe("1 değişen, 1 boyalı");
    expect(d.damageFlag).toBe(true);
    expect(d.horsepower).toBe(190);
    expect(d.engineSize).toBe(2);
    expect(d.fuelType).toBe("Dizel");
    expect(d.description).toContain("Tramer kaydı: 25.04.2022 ERP-Carpma ₺56131");
  });

  it("galerisi ve ekspertizi olmayan (satılmış) aracı okumaz", () => {
    expect(parseCarvakDynamic({ data: { mainResult: { car_id: 1 } } })).toBeNull();
    expect(parseCarvakDynamic({})).toBeNull();
  });
});

describe("parseDodDetail", () => {
  it("galeriyi sırasıyla, ekspertiz parçalarını ve resmi tüketimi okur", () => {
    const d = parseDodDetail(
      [
        { orderNo: 2, imagePathBig: "https://images.dod.com.tr/x_2_800x600.jpg" },
        { orderNo: 1, imagePathBig: "https://images.dod.com.tr/x_1_800x600.jpg" },
      ],
      { paintedPart: ["Ön Tampon", ""], changedPart: [""], localPaintedPart: ["Tavan"], crushedPart: ["Bagaj"], vehicleExpertiseStatus: "Boyanan Parça Var." },
      [{ brandName: "ALFA ROMEO", modelName: "GIULIETTA", modelYear: 2018, maxPowerHP: 120, ccTypeDefinitionDouble: 1.6, fuelTypeDefinition: "Dizel", fuelConsumptionInnerCity: 4.9, fuelConsumptionOuterCity: 3.3, color: "Gri", bodyTypeExplanation: "hatchback" }]
    )!;
    expect(d.images).toEqual(["https://images.dod.com.tr/x_1_800x600.jpg", "https://images.dod.com.tr/x_2_800x600.jpg"]);
    expect(d.damageParts).toEqual([
      { name: "Ön Tampon", state: "Boyanmış" },
      { name: "Tavan", state: "Lokal Boyanmış" },
    ]);
    expect(d.paintChange).toBe("1 boyalı, 1 lokal boyalı");
    expect(d.horsepower).toBe(120);
    expect(d.engineSize).toBe(1.6);
    // 4,9 × 0,37 + 3,3 × 0,63 = 3,89 → 3,9
    expect(d.avgFuelConsumption).toBe("3,9 lt");
    expect(d.bodyType).toBe("Hatchback");
    expect(d.description).toContain("Çizik/ezik: Bagaj");
  });

  it("hiç veri yoksa okumaz", () => {
    expect(parseDodDetail(null, null, null)).toBeNull();
  });
});

describe("parseOtomerkeziDetail", () => {
  const page = (id: string) =>
    `<script>self.__next_f.push([1,"{\\"images\\":[\\"https://asset.otomerkezi.net/car-photo/${id}_1.jpg\\",\\"https://asset.otomerkezi.net/car-photo/${id}_2.jfif\\"],\\"x\\":1} {\\"key\\":\\"frontBumper\\",\\"label\\":\\"Ön Tampon\\",\\"status\\":\\"painted\\"},{\\"key\\":\\"kaput\\",\\"label\\":\\"Motor Kaputu\\",\\"status\\":\\"ok\\"}"])</script><p>Toplam Hasar Kaydı: <span>Bilgi Yok</span></p><p>Hasar Detayı: <span>Bilgi Yok</span></p>`;

  it("sayfanın aracı bizimkiyse galeri ve ekspertizi okur", () => {
    const d = parseOtomerkeziDetail(page("2719"), "2719")!;
    expect(d.images).toHaveLength(2);
    expect(d.damageParts).toEqual([
      { name: "Ön Tampon", state: "Boyanmış" },
      { name: "Motor Kaputu", state: "Orijinal" },
    ]);
    expect(d.damageFlag).toBeUndefined();
  });

  it("aynı adresi paylaşan başka aracın sayfasını yazmaz", () => {
    expect(parseOtomerkeziDetail(page("2718"), "2700")).toBeNull();
  });
});
