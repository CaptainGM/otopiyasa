import { describe, expect, it } from "vitest";
import { codeExpiry, hashCode } from "./email-change";
import { attemptsLeft, checkResetCode } from "./reset-code";

const now = new Date("2026-10-03T10:00:00Z");
const fresh = () => ({ resetCodeHash: hashCode("123456"), resetCodeExpires: codeExpiry(now), resetCodeAttempts: 0 });

describe("checkResetCode", () => {
  it("doğru kodu kabul eder", () => {
    expect(checkResetCode(fresh(), "123456", now)).toBe("ok");
  });

  it("boşlukları yok sayar", () => {
    expect(checkResetCode(fresh(), " 123456 ", now)).toBe("ok");
  });

  it("yanlış kodu reddeder", () => {
    expect(checkResetCode(fresh(), "654321", now)).toBe("wrong");
  });

  it("kod hiç istenmemişse süresi dolmuş sayılır", () => {
    expect(checkResetCode({ resetCodeHash: null, resetCodeExpires: null }, "123456", now)).toBe("expired");
  });

  it("15 dakikadan sonra süresi dolar", () => {
    const later = new Date(now.getTime() + 16 * 60 * 1000);
    expect(checkResetCode(fresh(), "123456", later)).toBe("expired");
  });

  it("5 yanlıştan sonra doğru kod bile işe yaramaz", () => {
    expect(checkResetCode({ ...fresh(), resetCodeAttempts: 5 }, "123456", now)).toBe("locked");
  });
});

describe("attemptsLeft", () => {
  it("kalan hakkı sayar", () => {
    expect(attemptsLeft(1)).toBe(4);
    expect(attemptsLeft(5)).toBe(0);
    expect(attemptsLeft(9)).toBe(0);
  });
});
