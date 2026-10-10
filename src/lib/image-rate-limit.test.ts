import { afterEach, describe, expect, it } from "vitest";
import {
  IMAGE_RATE_LIMIT_MAX,
  checkImageRateLimit,
  resetImageRateLimit,
} from "@/lib/image-rate-limit";

function requestFromIp(ip: string) {
  return new Request("https://otopiyasa.app/api/img?u=https%3A%2F%2Fcdn.otoplus.com%2Fa.jpg&w=480", {
    headers: { "x-real-ip": ip },
  });
}

afterEach(() => resetImageRateLimit());

describe("image-rate-limit", () => {
  it("normal gezinmede (pencere başına sınırın altında) engellemez", () => {
    for (let i = 0; i < IMAGE_RATE_LIMIT_MAX; i++) {
      expect(checkImageRateLimit(requestFromIp("1.2.3.4"))).toBeNull();
    }
  });

  it("sınırı aşan isteğe 429 ve Retry-After döner", () => {
    for (let i = 0; i < IMAGE_RATE_LIMIT_MAX; i++) {
      checkImageRateLimit(requestFromIp("1.2.3.4"));
    }

    const blocked = checkImageRateLimit(requestFromIp("1.2.3.4"));
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(blocked?.headers.get("Cache-Control")).toBe("no-store");
  });

  it("bir kaynağın sınırı diğerini etkilemez", () => {
    for (let i = 0; i < IMAGE_RATE_LIMIT_MAX; i++) {
      checkImageRateLimit(requestFromIp("1.2.3.4"));
    }
    expect(checkImageRateLimit(requestFromIp("1.2.3.4"))?.status).toBe(429);
    expect(checkImageRateLimit(requestFromIp("9.9.9.9"))).toBeNull();
  });
});
