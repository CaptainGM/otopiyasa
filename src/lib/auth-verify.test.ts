import { describe, expect, it } from "vitest";
import {
  buildVerifyUrl,
  createVerifyToken,
  hashVerifyToken,
  isEmailVerified,
} from "./auth-verify";

describe("isEmailVerified (geriye uyumluluk)", () => {
  it("alanı olmayan eski kullanıcı doğrulanmış sayılır", () => {
    expect(isEmailVerified({})).toBe(true);
    expect(isEmailVerified({ emailVerified: undefined })).toBe(true);
  });

  it("açıkça doğrulanmış kullanıcı geçer", () => {
    expect(isEmailVerified({ emailVerified: true })).toBe(true);
  });

  it("YALNIZCA açıkça false olan (yeni, doğrulanmamış) hesap bloklanır", () => {
    expect(isEmailVerified({ emailVerified: false })).toBe(false);
  });
});

describe("createVerifyToken / hashVerifyToken", () => {
  it("token üretir ve hash'i deterministik doğrular", () => {
    const { token, tokenHash } = createVerifyToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(hashVerifyToken(token)).toBe(tokenHash);
  });

  it("her token benzersiz", () => {
    expect(createVerifyToken().token).not.toBe(createVerifyToken().token);
  });

  it("hash ham token'ı sızdırmaz (geri döndürülemez)", () => {
    const { token, tokenHash } = createVerifyToken();
    expect(tokenHash).not.toBe(token);
    expect(tokenHash).toHaveLength(64);
  });
});

describe("buildVerifyUrl", () => {
  it("e-postayı ve token'ı güvenle kodlar", () => {
    const url = buildVerifyUrl("https://otopiyasa.app", "a+b@gmail.com", "tok123");
    expect(url).toContain("email=a%2Bb%40gmail.com");
    expect(url).toContain("token=tok123");
    expect(url.startsWith("https://otopiyasa.app/verify-email?")).toBe(true);
  });
});
