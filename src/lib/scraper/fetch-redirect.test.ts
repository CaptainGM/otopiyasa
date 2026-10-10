import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/scraper/rate-limit", () => ({
  waitForSlot: async () => {},
  withRetry: async <T>(fn: () => Promise<T>) => fn(),
  sleep: async () => {},
}));

import { fetchPageHtml } from "./browser-scrape";

const LISTING = "https://www.arabam.com/ilan/galeriden-satilik-fiat-egea/baslik/123";
const CATEGORY = "https://www.arabam.com/ikinci-el/otomobil/fiat-egea";

function response(status: number, body = "", headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

describe("fetchPageHtml stopAtRedirect", () => {
  const calls: Array<{ url: string; redirect?: string }> = [];

  beforeEach(() => {
    calls.length = 0;
  });
  afterEach(() => vi.unstubAllGlobals());

  function stub(handler: (url: string) => Response) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "https://www.arabam.com/") return response(200, "ok", { "set-cookie": "sid=1; Path=/" });
        calls.push({ url, redirect: init?.redirect });
        return handler(url);
      })
    );
  }

  it("ölü ilanın yönlendiği kategori sayfasını indirmez, adresini döndürür", async () => {
    stub((url) => (url === LISTING ? response(301, "", { location: "/ikinci-el/otomobil/fiat-egea" }) : response(200, "<html>1 MB liste</html>")));
    const res = await fetchPageHtml(LISTING, { stopAtRedirect: true });
    expect(res).toMatchObject({ ok: true, html: "", finalUrl: CATEGORY });
    expect(calls).toEqual([{ url: LISTING, redirect: "manual" }]);
  });

  it("aynı ilanın yeni adresine yönleniyorsa onu izler ve sayfayı okur", async () => {
    const MOVED = "https://www.arabam.com/ilan/galeriden-satilik-fiat-egea-1-4/yeni-baslik/123";
    stub((url) => (url === LISTING ? response(301, "", { location: MOVED }) : response(200, "<html>ilan</html>")));
    const res = await fetchPageHtml(LISTING, { stopAtRedirect: true });
    expect(res.ok).toBe(true);
    expect(res.html).toContain("ilan");
    expect(calls.map((c) => c.url)).toEqual([LISTING, MOVED]);
  });

  it("seçenek verilmezse yönlendirmeyi eskisi gibi izler", async () => {
    stub(() => response(200, "<html>sayfa</html>"));
    await fetchPageHtml(LISTING);
    expect(calls[0].redirect).toBe("follow");
  });

  it("yönlendirme yoksa normal sayfayı döndürür", async () => {
    stub(() => response(200, "<html>canlı ilan</html>"));
    const res = await fetchPageHtml(LISTING, { stopAtRedirect: true });
    expect(res).toMatchObject({ ok: true, status: 200 });
    expect(res.html).toContain("canlı ilan");
  });
});
