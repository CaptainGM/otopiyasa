import { describe, expect, it } from "vitest";
import { escapeHtml, safeUrl } from "./mailer";

describe("e-posta kaçışlama", () => {
  it("kullanıcı metnindeki HTML'i etkisizleştirir", () => {
    const evil = `<a href="https://phish.example">Hesabın askıya alındı</a><img src=x onerror=alert(1)>`;
    const out = escapeHtml(evil);
    expect(out).not.toContain("<a");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;a href=&quot;https://phish.example&quot;&gt;");
  });

  it("tek tırnak ve ve-işaretini de kaçışlar", () => {
    expect(escapeHtml("Ali'nin & Veli")).toBe("Ali&#39;nin &amp; Veli");
  });

  it("yalnızca http(s) bağlantılara izin verir", () => {
    expect(safeUrl("https://otopiyasa.app/cars/1")).toBe("https://otopiyasa.app/cars/1");
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl('https://x.co/"><script>')).toBe("https://x.co/&quot;&gt;&lt;script&gt;");
  });
});
