import { describe, expect, it } from "vitest";
import { alnumVariants, brandSplitVariants, buildCandidates, compactKey, correctSearch, editDistances, maxEdits } from "./search-correct";

const FAMILIES: Record<string, string[]> = {
  Chery: ["Tiggo 4 Pro", "Tiggo 7", "Tiggo 7 Pro", "Tiggo 8 Pro", "Omoda 5"],
  Toyota: ["Corolla", "Yaris", "C-HR"],
  Volkswagen: ["Passat", "Golf", "Polo"],
  Hyundai: ["i20", "i30", "Tucson"],
  Peugeot: ["208", "2008", "3008"],
  Renault: ["Clio", "Megane"],
  BMW: ["3 Serisi", "5 Serisi", "320i"],
  Mercedes: ["C 180", "E 200"],
};
const candidates = buildCandidates(FAMILIES);
const strict = (q: string) => correctSearch(q, candidates, { strict: true });
const loose = (q: string) => correctSearch(q, candidates, { strict: false });
const labelOf = (q: string) => strict(q)?.label ?? null;

describe("compactKey", () => {
  it("boşluk, işaret ve Türkçe harfleri sadeleştirir", () => {
    expect(compactKey("Chery Tiggo 7 Pro")).toBe("cherytiggo7pro");
    expect(compactKey("ŞEVROLE ÇAĞRI")).toBe("sevrolecagri");
    expect(compactKey("C-HR")).toBe("chr");
    expect(compactKey("Skoda Kodiaq")).toBe("skodakodiaq");
  });
});

describe("editDistances", () => {
  it("harf hatasını 1, komşu harf yer değiştirmeyi 1 sayar", () => {
    expect(editDistances("tigo", "tiggo", 2).full).toBe(1);
    expect(editDistances("cilo", "clio", 2).full).toBe(1);
    expect(editDistances("corola", "corolla", 2).full).toBe(1);
  });

  it("rakam değişimini tolere etmez", () => {
    expect(editDistances("i30", "i20", 2).full).toBeGreaterThan(2);
    expect(editDistances("3008", "2008", 2).full).toBeGreaterThan(2);
  });

  it("önek eşleşmesinde c'nin devamını saymaz", () => {
    expect(editDistances("cherytiggo", "cherytiggo7pro", 1).prefix).toBe(0);
    expect(editDistances("cherytiggo", "cherytiggo7pro", 1).full).toBeGreaterThan(1);
  });

  it("maxEdits uzunluğa göre artar", () => {
    expect([maxEdits(3), maxEdits(5), maxEdits(8), maxEdits(9), maxEdits(13)]).toEqual([0, 1, 1, 2, 2]);
  });
});

describe("correctSearch", () => {
  it("bitişik yazım ve harf hatasını düzeltir", () => {
    expect(labelOf("cherytigo7pro")).toBe("Chery Tiggo 7 Pro");
    expect(labelOf("cherytiggo7pro")).toBe("Chery Tiggo 7 Pro");
    expect(labelOf("chery tigo 7 pro")).toBe("Chery Tiggo 7 Pro");
    expect(labelOf("toyotacorola")).toBe("Toyota Corolla");
    expect(labelOf("hyundaii20")).toBe("Hyundai i20");
  });

  it("birkaç harf hatası olan uzun model adını son çare olarak bulur: carallo → Corolla", () => {
    expect(labelOf("carallo")).toBe("Corolla");
    expect(loose("toyota carallo")?.label).toBe("Toyota Corolla");
    expect(loose("carallo 1.6")?.label).toBe("Corolla");
    expect(loose("carallo 1.6")?.extraWords).toEqual(["1.6"]);
  });

  it("son çare eşleşmesi alakasız kelimede uydurma sonuç vermez", () => {
    expect(labelOf("xyzzy")).toBeNull();
    expect(labelOf("qwerty")).toBeNull();
  });

  it("önek eşleşmesinde ilk harf aynı olmalı: başıboş 'x' silinip Linea bulunmaz", () => {
    const candidates = buildCandidates({ BMW: ["X1"], Fiat: ["Linea"] });
    expect(correctSearch("xline", candidates, { strict: false })).toBeNull();
    expect(correctSearch("BMWX1 18i sDrive X Line", candidates, { strict: false })?.label).toBe("BMW X1");
  });

  it("yalnızca model adındaki hatayı da düzeltir", () => {
    expect(labelOf("corola")).toBe("Corolla");
    expect(labelOf("pasat")).toBe("Passat");
    expect(labelOf("cilo")).toBe("Clio");
  });

  it("yarım yazılmış model adını sözlükteki ailelerle eşleştirir", () => {
    expect(labelOf("cherytiggo")).toBe("Chery Tiggo");
    expect(strict("cherytiggo")?.matches.length).toBeGreaterThan(1);
    expect(labelOf("bmw320")).toBe("BMW 320i");
  });

  it("rakamları korur: i30 ile i20, 3008 ile 2008 karışmaz", () => {
    expect(labelOf("i30")).toBe("i30");
    expect(labelOf("3008")).toBe("3008");
    expect(strict("i40")).toBeNull();
    expect(strict("4008")).toBeNull();
  });

  it("anlamsız metni düzeltmez", () => {
    expect(strict("xyzxyz")).toBeNull();
    expect(strict("qwertyuiop")).toBeNull();
    expect(strict("ab")).toBeNull();
  });

  it("yakıt, vites ve yılı filtre olarak ayırır", () => {
    const found = strict("cherytigo7pro dizel otomatik 2023");
    expect(found?.label).toBe("Chery Tiggo 7 Pro · Dizel · Otomatik · 2023");
    expect(found?.fuelType).toBe("Dizel");
    expect(found?.transmission).toBe("Otomatik");
    expect(found?.year).toBe(2023);
    expect(found?.extraWords).toEqual([]);
  });

  it("açıklanamayan kelime sıkı modda düzeltmeyi engeller, gevşek modda ek kelime olur", () => {
    expect(strict("galeriden cherytigo7pro")).toBeNull();
    const found = loose("galeriden cherytigo7pro");
    expect(found?.label).toBe("Chery Tiggo 7 Pro");
    expect(found?.extraWords).toEqual(["galeriden"]);
  });

  it("boş arama düzeltilmez", () => {
    expect(strict("")).toBeNull();
    expect(strict("   ")).toBeNull();
  });

  it("eşit uzaklıktaki birkaç adı birlikte yazar", () => {
    const tied = buildCandidates({ Toyota: ["Corolla", "Corona", "Yaris"] });
    expect(correctSearch("toyotacorola", tied, { strict: true })?.label).toBe("Toyota Corolla / Toyota Corona");
  });
});

describe("alnumVariants", () => {
  it("harf-rakam sınırında ayırır ve bitiştirir", () => {
    expect(alnumVariants("mercedes c180")).toEqual(["mercedes c 180"]);
    expect(alnumVariants("mercedes c 180")).toEqual(["mercedes c180"]);
    expect(alnumVariants("bmw 320 i")).toEqual(["bmw 320i"]);
  });

  it("ayrılacak ya da bitişecek bir şey yoksa boş döner", () => {
    expect(alnumVariants("passat")).toEqual([]);
    expect(alnumVariants("renault clio")).toEqual([]);
    expect(alnumVariants("")).toEqual([]);
  });

  it("noktalı sayıları bölmez", () => {
    expect(alnumVariants("golf 1.6")).toEqual([]);
  });
});

describe("brandSplitVariants", () => {
  const brands = ["BMW", "Chery", "Hyundai", "Mercedes-Benz", "Volkswagen"];

  it("boşluksuz yazılmış marka + model metninde markayı ayırır", () => {
    expect(brandSplitVariants("bmw320i", brands)).toEqual(["BMW 320i"]);
    expect(brandSplitVariants("mercedesbenzc180", brands)).toEqual(["Mercedes-Benz c180"]);
    expect(brandSplitVariants("mercedesc180", brands)).toEqual(["Mercedes c180"]);
    expect(brandSplitVariants("hyundaii20", brands)).toEqual(["Hyundai i20"]);
  });

  it("marka adındaki tek harf hatasını tolere eder", () => {
    expect(brandSplitVariants("hundaii20", brands)).toEqual(["Hyundai i20"]);
    expect(brandSplitVariants("volkswagnpasat", brands)).toEqual(["Volkswagen pasat"]);
  });

  it("marka ya da model kalmıyorsa boş döner", () => {
    expect(brandSplitVariants("bmw", brands)).toEqual([]);
    expect(brandSplitVariants("xyzxyzxyz", brands)).toEqual([]);
  });
});
