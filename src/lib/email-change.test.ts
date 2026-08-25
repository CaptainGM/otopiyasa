import { describe, expect, it } from "vitest";
import {
  generateCode,
  hashCode,
  codeMatches,
  codeExpiry,
  isExpired,
  stageOf,
  maskEmail,
} from "./email-change";

describe("generateCode", () => {
  it("her zaman 6 haneli sayısal bir kod üretir", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe("codeMatches", () => {
  it("doğru kodu kabul eder", () => {
    const code = "042817";
    expect(codeMatches(code, hashCode(code))).toBe(true);
  });

  it("yanlış kodu reddeder", () => {
    expect(codeMatches("111111", hashCode("222222"))).toBe(false);
  });

  it("hash yoksa reddeder", () => {
    expect(codeMatches("111111", null)).toBe(false);
    expect(codeMatches("111111", undefined)).toBe(false);
  });

  it("baştaki/sondaki boşlukları görmezden gelir", () => {
    const code = "555555";
    expect(codeMatches("  555555  ", hashCode(code))).toBe(true);
  });
});

describe("isExpired / codeExpiry", () => {
  it("codeExpiry ile üretilen zaman henüz dolmamıştır", () => {
    expect(isExpired(codeExpiry())).toBe(false);
  });

  it("geçmiş bir tarih süresi dolmuş sayılır", () => {
    expect(isExpired(new Date(Date.now() - 1000))).toBe(true);
  });

  it("tarih yoksa süresi dolmuş sayılır", () => {
    expect(isExpired(null)).toBe(true);
    expect(isExpired(undefined)).toBe(true);
  });
});

describe("stageOf", () => {
  it("pendingEmail yoksa idle döner", () => {
    expect(stageOf({})).toBe("idle");
  });

  it("kod süresi dolmuşsa idle döner", () => {
    expect(
      stageOf({
        pendingEmail: "yeni@ornek.com",
        currentCodeHash: "hash",
        codeExpires: new Date(Date.now() - 1000),
      })
    ).toBe("idle");
  });

  it("currentCodeHash varsa awaiting-current döner", () => {
    expect(
      stageOf({
        pendingEmail: "yeni@ornek.com",
        currentCodeHash: "hash",
        codeExpires: codeExpiry(),
      })
    ).toBe("awaiting-current");
  });

  it("newCodeHash varsa awaiting-new döner", () => {
    expect(
      stageOf({
        pendingEmail: "yeni@ornek.com",
        newCodeHash: "hash",
        codeExpires: codeExpiry(),
      })
    ).toBe("awaiting-new");
  });
});

describe("maskEmail", () => {
  it("kısa yerel kısmı da en az 3 yıldızla gizler", () => {
    expect(maskEmail("ab@ornek.com")).toBe("ab***@ornek.com");
  });

  it("uzun yerel kısmın yalnızca ilk 2 harfini gösterir", () => {
    expect(maskEmail("kullaniciadi@gmail.com")).toBe("ku**********@gmail.com");
  });
});
