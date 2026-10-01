import { describe, expect, it } from "vitest";
import { clampProxyWidth, isProxyableImage, proxiedImageUrl, proxyHostFor } from "./image-proxy";

describe("image-proxy", () => {
  it("yalnızca izinli kaynakları tanır, açık proxy olmaz", () => {
    expect(isProxyableImage("https://dat-tr-prda-ops-vava.azureedge.net/cars/1/a.webp")).toBe(true);
    expect(isProxyableImage("https://images.kavak.services/images/1/a.jpeg")).toBe(true);
    expect(isProxyableImage("https://asset.otomerkezi.net/car-photo/1.jpg")).toBe(true);
    expect(isProxyableImage("https://cdn.otoplus.com/a.jpg")).toBe(true);
    expect(isProxyableImage("https://example.com/a.jpg")).toBe(false);
    expect(isProxyableImage("http://asset.otomerkezi.net/a.jpg")).toBe(false);
    expect(isProxyableImage("file:///etc/passwd")).toBe(false);
    expect(isProxyableImage("https://asset.otomerkezi.net.evil.com/a.jpg")).toBe(false);
    expect(isProxyableImage("not a url")).toBe(false);
    expect(proxyHostFor("https://asset.otomerkezi.net/a.jpg")?.referer).toBe("https://www.otomerkezi.net/");
  });

  it("genişliği sınırlar ve 80 px adımlarına yuvarlar", () => {
    expect(clampProxyWidth(50)).toBe(160);
    expect(clampProxyWidth(5000)).toBe(1280);
    expect(clampProxyWidth(Number.NaN)).toBe(480);
    expect(proxiedImageUrl("https://asset.otomerkezi.net/a.jpg", 470)).toContain("&w=480");
    expect(proxiedImageUrl("https://asset.otomerkezi.net/a.jpg", 300)).toContain("&w=320");
    expect(proxiedImageUrl("https://asset.otomerkezi.net/a.jpg", 480, "https://otopiyasa.app")).toMatch(/^https:\/\/otopiyasa\.app\/api\/img\?u=/);
  });
});
