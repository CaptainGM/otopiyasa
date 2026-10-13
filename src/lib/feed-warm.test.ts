import { describe, expect, it, vi } from "vitest";
import { FEED_ROTATE_MS, FEED_SLOTS } from "./car-mix";
import { feedPageQuery, feedSliceQuery } from "./feed-url";
import { bucketsToWarm, feedWarmBaseUrl, feedWarmUrls, warmFeedSlots } from "./feed-warm";

describe("feed-url", () => {
  it("dilim ve sayfa sorgusu sabit sırada kurulur (CDN adresin tamamına göre saklar)", () => {
    expect(feedSliceQuery("limit=24", 7, 1990997)).toBe("limit=24&slot=7&b=1990997");
    expect(feedPageQuery("limit=24&slot=7&b=1990997", 1, 24)).toBe("limit=24&slot=7&b=1990997&page=1&compact=1");
  });

  it("tohum atılır, sayfa ve sınır yeniden yazılır", () => {
    expect(feedSliceQuery("seed=5&limit=24", 3, 10)).toBe("limit=24&slot=3&b=10");
    expect(feedPageQuery("limit=12&slot=3&b=10", 2, 24)).toBe("limit=24&slot=3&b=10&page=2&compact=1");
  });
});

describe("feedWarmUrls", () => {
  it("24 dilimin tam adresini üretir; canlıda HIT dönen adresle birebir aynı", () => {
    const urls = feedWarmUrls("https://otopiyasa.app", 1990997);
    expect(urls).toHaveLength(FEED_SLOTS);
    expect(urls[23]).toBe("https://otopiyasa.app/api/cars?limit=24&slot=23&b=1990997&page=1&compact=1");
    expect(new Set(urls).size).toBe(FEED_SLOTS);
  });
});

describe("feedWarmBaseUrl", () => {
  it("yerel ya da https olmayan adres yerine canlı adres kullanılır (CDN yalnızca yayındadır)", () => {
    expect(feedWarmBaseUrl("")).toBe("https://otopiyasa.app");
    expect(feedWarmBaseUrl("http://localhost:3000")).toBe("https://otopiyasa.app");
    expect(feedWarmBaseUrl("https://localhost:3000")).toBe("https://otopiyasa.app");
    expect(feedWarmBaseUrl("http://otopiyasa.app")).toBe("https://otopiyasa.app");
  });

  it("yayındaki https adresi kullanılır, sondaki eğik çizgi atılır", () => {
    expect(feedWarmBaseUrl("https://otopiyasa.app/")).toBe("https://otopiyasa.app");
    expect(feedWarmBaseUrl("https://ornek.com")).toBe("https://ornek.com");
  });
});

describe("bucketsToWarm", () => {
  const start = 1990997 * FEED_ROTATE_MS;
  it("dönemin başında yalnızca şimdiki dönem", () => {
    expect(bucketsToWarm(start + 60_000)).toEqual([1990997]);
  });

  it("dönem değişmesine 4 dakikadan az kalınca bir sonraki de ısıtılır", () => {
    expect(bucketsToWarm(start + FEED_ROTATE_MS - 3 * 60_000)).toEqual([1990997, 1990998]);
  });
});

describe("warmFeedSlots", () => {
  const okResponse = { ok: true, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Response;
  const failResponse = { ok: false, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Response;

  it("geçici hatalı dilimi bir kez daha dener ve kurtarır", async () => {
    let calls = 0;
    const fetcher = vi.fn(async () => {
      calls += 1;
      if (calls === 5) throw new Error("ağ hatası");
      return calls === 6 ? failResponse : okResponse;
    }) as unknown as typeof fetch;
    const result = await warmFeedSlots("https://otopiyasa.app", 123, { fetcher, pauseMs: 0 });
    expect(result).toEqual({ ok: FEED_SLOTS, failed: 0 });
    expect(fetcher).toHaveBeenCalledTimes(FEED_SLOTS + 2);
  });

  it("sürekli hata veren dilimi başarısız sayar, diğerlerini etkilemez", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("slot=3&") ? failResponse : okResponse
    ) as unknown as typeof fetch;
    const result = await warmFeedSlots("https://otopiyasa.app", 123, { fetcher, pauseMs: 0 });
    expect(result).toEqual({ ok: FEED_SLOTS - 1, failed: 1 });
    expect(fetcher).toHaveBeenCalledTimes(FEED_SLOTS + 1);
  });
});
