import { describe, it, expect } from "vitest";
import { parseAmount, extractSearchTerm } from "./chatbot";

describe("parseAmount", () => {
  it("'bin' ve 'milyon' ifadelerini çevirir", () => {
    expect(parseAmount("500 bin altı bmw")).toBe(500_000);
    expect(parseAmount("1 milyon altında audi")).toBe(1_000_000);
    expect(parseAmount("1,5 milyon")).toBe(1_500_000);
    expect(parseAmount("750 bin")).toBe(750_000);
  });

  it("düz büyük sayıyı okur", () => {
    expect(parseAmount("850000 altında")).toBe(850_000);
  });

  it("miktar yoksa null döner", () => {
    expect(parseAmount("en ucuz toyota")).toBeNull();
    expect(parseAmount("merhaba")).toBeNull();
  });
});

describe("extractSearchTerm", () => {
  it("niyet kelimelerini atıp arama terimini bulur", () => {
    expect(extractSearchTerm("beni 320i ilanlarına yönlendir")).toBe("320i");
    expect(extractSearchTerm("bmw 320i ilanları")).toBe("320i");  
    expect(extractSearchTerm("toyota corolla araçları göster")).toBe("corolla");
  });

  it("tek kelime yazılan fiil biçimlerini eler (yönlendirimisin bug'ı)", () => {
    expect(extractSearchTerm("beni audi ilanlarına yönlendirmisin")).toBe("audi");
    expect(extractSearchTerm("beni audi ilanlarına yönlendirirmisin")).toBe("audi");
    expect(extractSearchTerm("bmw ilanları gösterirmisin")).toBe("bmw");
  });

  it("sadece yönlendirme kelimesi varsa boş döner", () => {
    expect(extractSearchTerm("ilana git")).toBe("");
    expect(extractSearchTerm("yönlendir beni")).toBe("");
    expect(extractSearchTerm("yönlendirirmisin")).toBe("");
  });
});
