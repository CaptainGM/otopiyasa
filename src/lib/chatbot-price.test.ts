import { describe, expect, it } from "vitest";
import { isPlainPriceQuestion } from "./chatbot";

describe("isPlainPriceQuestion", () => {
  it("model/marka ve tek yıl içeren düz fiyat sorularını kabul eder", () => {
    expect(isPlainPriceQuestion("renault clio 2020 fiyatı ne kadar")).toBe(true);
    expect(isPlainPriceQuestion("2020 clio ne kadar")).toBe(true);
    expect(isPlainPriceQuestion("bmw 320i fiyatı")).toBe(true);
    expect(isPlainPriceQuestion("togg t10x fiyatı")).toBe(true);
    expect(isPlainPriceQuestion("peugeot 2008 fiyatı")).toBe(true);
  });

  it("sıralama, ortalama, aralık, yakıt, vites ya da yön içeren soruları reddeder", () => {
    expect(isPlainPriceQuestion("en ucuz clio fiyatı")).toBe(false);
    expect(isPlainPriceQuestion("doblo ortalama fiyat")).toBe(false);
    expect(isPlainPriceQuestion("1 milyon altı clio fiyatı")).toBe(false);
    expect(isPlainPriceQuestion("2020 sonrası clio fiyatı")).toBe(false);
    expect(isPlainPriceQuestion("2015 altı bmw fiyatı")).toBe(false);
    expect(isPlainPriceQuestion("dizel clio 2020 fiyatı")).toBe(false);
    expect(isPlainPriceQuestion("otomatik clio fiyatı")).toBe(false);
    expect(isPlainPriceQuestion("2015-2020 clio fiyatı")).toBe(false);
  });

  it("fiyat tahmini ve kaç ilan soruları düz fiyat sayılmaz", () => {
    expect(isPlainPriceQuestion("fiyat tahmini nasıl çalışıyor")).toBe(false);
    expect(isPlainPriceQuestion("motosiklet fiyat tahmini nasıl")).toBe(false);
    expect(isPlainPriceQuestion("renault clio fiyatı kaç ilan var")).toBe(false);
  });
});
