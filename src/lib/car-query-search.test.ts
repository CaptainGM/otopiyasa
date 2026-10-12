import { describe, expect, it } from "vitest";
import { textSearchOptions } from "./car-query";

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
