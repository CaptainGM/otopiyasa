import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/api-rate-limit";

function requestFromIp(ip: string) {
  return new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("checkRateLimit", () => {
  it("limit içindeki istekleri geçirir, aşınca 429 döner", () => {
    const bucket = `test-${Date.now()}-a`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(requestFromIp("1.2.3.4"), bucket, { limit: 3 })).toBeNull();
    }
    const blocked = checkRateLimit(requestFromIp("1.2.3.4"), bucket, { limit: 3 });
    expect(blocked?.status).toBe(429);
  });

  it("farklı IP'ler birbirini etkilemez", () => {
    const bucket = `test-${Date.now()}-b`;
    checkRateLimit(requestFromIp("5.5.5.5"), bucket, { limit: 1 });
    expect(checkRateLimit(requestFromIp("6.6.6.6"), bucket, { limit: 1 })).toBeNull();
  });

  it("farklı bucket'lar ayrı sayılır", () => {
    const now = Date.now();
    checkRateLimit(requestFromIp("7.7.7.7"), `test-${now}-c`, { limit: 1 });
    expect(
      checkRateLimit(requestFromIp("7.7.7.7"), `test-${now}-d`, { limit: 1 })
    ).toBeNull();
  });


  it("x-forwarded-for'un sol tarafı değiştirilerek limit aşılamaz", () => {
    const bucket = `test-${Date.now()}-spoof`;
    const spoofed = (fake: string) =>
      new Request("http://localhost/api/test", {
        headers: { "x-forwarded-for": `${fake}, 9.9.9.9` },
      });

    expect(checkRateLimit(spoofed("1.1.1.1"), bucket, { limit: 2 })).toBeNull();
    expect(checkRateLimit(spoofed("2.2.2.2"), bucket, { limit: 2 })).toBeNull();
    
    expect(checkRateLimit(spoofed("3.3.3.3"), bucket, { limit: 2 })?.status).toBe(429);
  });

  it("x-real-ip varsa x-forwarded-for'a tercih edilir", () => {
    const bucket = `test-${Date.now()}-real`;
    const req = (fwd: string) =>
      new Request("http://localhost/api/test", {
        headers: { "x-forwarded-for": fwd, "x-real-ip": "8.8.8.8" },
      });

    expect(checkRateLimit(req("1.1.1.1"), bucket, { limit: 1 })).toBeNull();
    expect(checkRateLimit(req("4.4.4.4"), bucket, { limit: 1 })?.status).toBe(429);
  });
});
