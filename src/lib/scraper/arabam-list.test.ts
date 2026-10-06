import { describe, expect, it } from "vitest";
import { dominantBodyType, jsonValueEnd, normalizeArabamGear, parseArabamListPage } from "./arabam-list";
import { normalizeBodyType } from "@/lib/vehicle-attrs";

const doc = (over: Record<string, unknown> = {}) => ({
  Id: 44179894,
  Url: "/ilan/galeriden-satilik-chevrolet-captiva-2-0-d-lt-high/muftuoglundan-satilik-captiva/44179894",
  Title: 'TEMİZ [HATASIZ] "CAPTİVA" } {',
  Year: 2011,
  Km: "220.000 KM",
  FormattedPrice: "805.000 TL",
  City: "Bursa",
  DetailedProperties: [
    { Key: "Kilometre", Value: "220.000 KM" },
    { Key: "Yakıt tipi", Value: "Dizel" },
    { Key: "Vites tipi", Value: "Otomatik" },
  ],
  PropertyListWithKey: [
    { Key: 0, Name: "Kilometre", Description: "220.000 KM" },
    { Key: 53, Name: "Renk", Description: "gri (titanyum)" },
  ],
  Categories: [
    { AbsolutePath: "arazi-suv-pick-up" },
    { AbsolutePath: "arazi-suv-pick-up/chevrolet" },
    { AbsolutePath: "arazi-suv-pick-up/chevrolet-captiva" },
  ],
  ...over,
});

const page = (docs: unknown[]) => {
  const model = {
    BreadCrumb: [{ Name: "Otomobil" }],
    Facets: [
      { Items: [{ Name: "Düz", Value: "Düz", Count: 10 }], Name: "Vites tipi" },
      { Items: [{ Value: "Crossover", Count: 1 }, { Value: "SUV", Count: 613 }], Name: "Kasa tipi" },
    ],
    Success: true,
    Total: 614,
    TotalPages: 31,
    Documents: docs,
  };
  return `<html><script id="model-data">\n    var model = ${JSON.stringify(model)};\n</script><table></table></html>`;
};

describe("parseArabamListPage", () => {
  it("gömülü veriden vites, yakıt, renk, km, fiyat ve model yolunu okur", () => {
    const parsed = parseArabamListPage(page([doc(), doc({ Id: 43350088, Url: "/ilan/x/y/43350088", DetailedProperties: [{ Key: "Vites tipi", Value: "Düz" }], FormattedPrice: "12.000 EUR" })]));
    expect(parsed.total).toBe(614);
    expect(parsed.totalPages).toBe(31);
    expect(parsed.docs).toHaveLength(2);
    expect(parsed.docs[0]).toMatchObject({
      id: "44179894",
      year: 2011,
      mileage: 220000,
      price: 805000,
      transmission: "Otomatik",
      fuelType: "Dizel",
      color: "Gri (Titanyum)",
      city: "Bursa",
      modelPath: "arazi-suv-pick-up/chevrolet-captiva",
    });
    expect(parsed.docs[0].url).toBe("https://www.arabam.com/ilan/galeriden-satilik-chevrolet-captiva-2-0-d-lt-high/muftuoglundan-satilik-captiva/44179894");
    // Düz → Manuel; TL olmayan fiyat okunmaz; yakıt yazmıyorsa tahmin edilmez.
    expect(parsed.docs[1]).toMatchObject({ transmission: "Manuel", price: null, fuelType: null });
    expect(parsed.bodyTypes).toEqual([
      { value: "Crossover", count: 1 },
      { value: "SUV", count: 613 },
    ]);
  });

  it("veri yoksa ya da bozuksa boş döner", () => {
    expect(parseArabamListPage("<html>Cloudflare</html>").docs).toEqual([]);
    expect(parseArabamListPage("var model = {bozuk").docs).toEqual([]);
  });

  it("kimliği ya da ilan adresi olmayan kayıtları atlar", () => {
    const parsed = parseArabamListPage(page([doc({ Id: null }), doc({ Url: "/reklam" }), doc()]));
    expect(parsed.docs.map((d) => d.id)).toEqual(["44179894"]);
  });
});

describe("jsonValueEnd", () => {
  it("metin içindeki ayraçları saymaz", () => {
    const text = 'x {"a":"} ]","b":[1,{"c":"\\"}"}]} y';
    const start = text.indexOf("{");
    expect(text.slice(start, jsonValueEnd(text, start) + 1)).toBe('{"a":"} ]","b":[1,{"c":"\\"}"}]}');
  });
});

describe("normalizeArabamGear", () => {
  it("kaynağın vites yazımlarını eşler", () => {
    expect(normalizeArabamGear("Düz")).toBe("Manuel");
    expect(normalizeArabamGear("Otomatik")).toBe("Otomatik");
    expect(normalizeArabamGear("Yarı Otomatik")).toBe("Yarı Otomatik");
    expect(normalizeArabamGear("")).toBeNull();
  });
});

describe("dominantBodyType", () => {
  it("tek kasa tipli modelde o tipi, karışık modelde null döndürür", () => {
    expect(dominantBodyType([{ value: "SUV", count: 613 }, { value: "Crossover", count: 1 }], normalizeBodyType)).toBe("SUV");
    expect(
      dominantBodyType(
        [{ value: "Sedan", count: 5000 }, { value: "Hatchback/5", count: 2500 }, { value: "Station wagon", count: 500 }],
        normalizeBodyType
      )
    ).toBeNull();
    expect(dominantBodyType([{ value: "SUV", count: 3 }], normalizeBodyType)).toBeNull();
  });
});
