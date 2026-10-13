import { describe, expect, it } from "vitest";
import { collapseSpacedLetters, textSearchOptions } from "./car-query";

describe("collapseSpacedLetters", () => {
  it("harf ve rakamları aralıklı yazılmış kelimeyi birleştirir", () => {
    expect(collapseSpacedLetters("b m w 3 2 0 i")).toBe("bmw320i");
    expect(collapseSpacedLetters("M a z d a 3 2 3")).toBe("Mazda323");
  });

  it("motor hacmini ve ondalık sayıyı bozmaz", () => {
    expect(collapseSpacedLetters("M a z d a 3 2 3 1.5 1.5i")).toBe("Mazda323 1.5 1.5i");
    expect(collapseSpacedLetters("V 4 0 1.6 D Premium")).toBe("V40 1.6 D Premium");
    expect(collapseSpacedLetters("C h e v r o l e t A v e o 1 . 4 L T")).toBe("ChevroletAveo 1.4 LT");
    expect(collapseSpacedLetters("corolla hibrit")).toBe("corolla hibrit");
    expect(collapseSpacedLetters("Mercedes C 200")).toBe("Mercedes C 200");
    expect(collapseSpacedLetters("Renault Clio 1.2 16 V")).toBe("Renault Clio 1.2 16 V");
  });
});

describe("textSearchOptions", () => {
  it("rakam içeren model kodunda yazım toleransı kapalı: i30 i20'ye düşmez", () => {
    expect(textSearchOptions("i30").fuzzy).toBeUndefined();
    expect(textSearchOptions("3008").fuzzy).toBeUndefined();
    expect(textSearchOptions("320i").fuzzy).toBeUndefined();
  });

  it("kısa düz kelimede de toleransı kapalı (golf/gulf gibi çakışmalar)", () => {
    expect(textSearchOptions("golf").fuzzy).toBeUndefined();
  });

  it("uzun düz kelimede tek harf toleransı açık (volksvagen -> Volkswagen)", () => {
    expect(textSearchOptions("volksvagen").fuzzy).toEqual({ maxEdits: 1, prefixLength: 1 });
  });

  it("aranan metni ve alanları her durumda korur", () => {
    expect(textSearchOptions("i30")).toMatchObject({ query: "i30", path: ["title", "brand", "model", "city"] });
  });
});
