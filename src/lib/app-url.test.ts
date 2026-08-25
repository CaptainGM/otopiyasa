import { describe, expect, it } from "vitest";
import { sanitizeBaseUrl } from "@/lib/app-url";


describe("sanitizeBaseUrl", () => {
  it("baştaki BOM'u temizler (canlıda 404'e sebep olan hata)", () => {
    expect(sanitizeBaseUrl("﻿https://otopiyasa.app")).toBe("https://otopiyasa.app");
  });

  it("baş/son boşlukları ve satır sonunu temizler", () => {
    expect(sanitizeBaseUrl("  https://otopiyasa.app \n")).toBe("https://otopiyasa.app");
  });

  it("sondaki eğik çizgiyi atar (çift // olmasın)", () => {
    expect(sanitizeBaseUrl("https://otopiyasa.app/")).toBe("https://otopiyasa.app");
    expect(sanitizeBaseUrl("https://otopiyasa.app///")).toBe("https://otopiyasa.app");
  });

  it("temiz değeri olduğu gibi bırakır", () => {
    expect(sanitizeBaseUrl("https://otopiyasa.app")).toBe("https://otopiyasa.app");
    expect(sanitizeBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("boş/tanımsız/geçersiz değerde varsayılana düşer", () => {
    expect(sanitizeBaseUrl(undefined)).toBe("https://otopiyasa.app");
    expect(sanitizeBaseUrl("")).toBe("https://otopiyasa.app");
    expect(sanitizeBaseUrl("   ")).toBe("https://otopiyasa.app");
    expect(sanitizeBaseUrl("bu bir adres degil")).toBe("https://otopiyasa.app");
  });

  it("http/https dışı şemaları reddeder", () => {
    expect(sanitizeBaseUrl("javascript:alert(1)")).toBe("https://otopiyasa.app");
    expect(sanitizeBaseUrl("ftp://otopiyasa.app")).toBe("https://otopiyasa.app");
  });

  it("verilen yedek değeri kullanır", () => {
    expect(sanitizeBaseUrl(undefined, "http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("bağlantı kurulumu çift eğik çizgi üretmez", () => {
    const base = sanitizeBaseUrl("﻿https://otopiyasa.app/");
    expect(`${base}/reset-password?token=abc`).toBe(
      "https://otopiyasa.app/reset-password?token=abc"
    );
  });
});
