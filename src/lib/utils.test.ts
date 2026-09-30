import { describe, it, expect } from "vitest";
import { escapeRegExp, turkishSearchRegex, levenshtein, formatRelativeTr } from "./utils";

describe("formatRelativeTr", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  it("kısa Türkçe göreli zaman üretir", () => {
    expect(formatRelativeTr(new Date("2026-09-30T11:59:40Z"), now)).toBe("az önce");
    expect(formatRelativeTr(new Date("2026-09-30T11:15:00Z"), now)).toBe("45 dk önce");
    expect(formatRelativeTr(new Date("2026-09-30T07:00:00Z"), now)).toBe("5 saat önce");
    expect(formatRelativeTr(new Date("2026-09-27T12:00:00Z"), now)).toBe("3 gün önce");
    expect(formatRelativeTr("2026-06-30T12:00:00Z", now)).toBe("3 ay önce");
  });
  it("boş/geçersiz değerde boş döner", () => {
    expect(formatRelativeTr(undefined, now)).toBe("");
    expect(formatRelativeTr("bozuk", now)).toBe("");
  });
});

describe("levenshtein", () => {
  it("düzenleme mesafesini doğru hesaplar", () => {
    expect(levenshtein("picanta", "picanto")).toBe(1);
    expect(levenshtein("corola", "corolla")).toBe(1);
    expect(levenshtein("golf", "golf")).toBe(0);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("clio", "megane")).toBeGreaterThan(2);
  });
});

describe("escapeRegExp", () => {
  it("özel regex karakterlerini kaçırır", () => {
    expect(escapeRegExp("a+b")).toBe("a\\+b");
    expect(escapeRegExp("(a+)+$")).toBe("\\(a\\+\\)\\+\\$");
    expect(escapeRegExp("c.k*")).toBe("c\\.k\\*");
  });

  it("normal metni değiştirmez", () => {
    expect(escapeRegExp("BMW")).toBe("BMW");
    expect(escapeRegExp("Mercedes Benz")).toBe("Mercedes Benz");
  });

  it("kaçırılan girdi RegExp içinde literal eşleşir (ReDoS önlenir)", () => {
    const evil = "(a+)+$";
    const re = new RegExp(escapeRegExp(evil), "i");
    expect(re.test("(a+)+$")).toBe(true);
    expect(re.test("aaaaaaaaaa")).toBe(false);
  });
});

describe("turkishSearchRegex", () => {
  const matches = (query: string, target: string) =>
    new RegExp(turkishSearchRegex(query), "i").test(target);

  it("noktalı/noktasız i farkını yok sayar (AUDİ = audi = Audi)", () => {
    expect(matches("AUDİ", "Audi")).toBe(true);
    expect(matches("audi", "Audi")).toBe(true);
    expect(matches("audı", "Audi")).toBe(true);
    expect(matches("İSTANBUL", "İstanbul")).toBe(true);
    expect(matches("istanbul", "İstanbul")).toBe(true);
  });

  it("diğer Türkçe harfleri de eşler (ş/ğ/ü/ö/ç)", () => {
    expect(matches("ŞAHIN", "Şahin")).toBe(true);
    expect(matches("gülsuyu", "Gülsuyu")).toBe(true);
  });

  it("alakasız metni eşlemez ve özel karakterleri kaçırır", () => {
    expect(matches("BMW", "Audi")).toBe(false);
    expect(matches("(a+)+$", "(a+)+$")).toBe(true);
    expect(matches("(a+)+$", "aaaa")).toBe(false);
  });
});
