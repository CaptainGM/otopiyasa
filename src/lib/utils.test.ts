import { describe, it, expect } from "vitest";
import { escapeRegExp, turkishSearchRegex, levenshtein } from "./utils";

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
