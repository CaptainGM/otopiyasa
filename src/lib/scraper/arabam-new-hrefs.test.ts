import { describe, expect, it } from "vitest";
import { pickUnknownArabamHrefs } from "./arabam-new-hrefs";

const toId = (href: string) => href.match(/(\d+)\/?$/)?.[1] ?? null;

describe("pickUnknownArabamHrefs", () => {
  it("veritabanında olan ilanları atlar, yeniler sırayla kalır", () => {
    const hrefs = [
      "/ilan/otomobil-a-1001",
      "/ilan/otomobil-b-1002",
      "/ilan/otomobil-c-1003",
    ];
    const known = new Set(["arabam-1001", "arabam-1003"]);
    expect(pickUnknownArabamHrefs(hrefs, toId, known)).toEqual(["/ilan/otomobil-b-1002"]);
  });

  it("kimliği çıkmayan bağlantıyı yeni saymaz", () => {
    expect(pickUnknownArabamHrefs(["/ilan/bozuk"], toId, new Set())).toEqual([]);
  });

  it("hepsi kayıtlıysa boş döner (bütçe yenilere ayrılır)", () => {
    const hrefs = Array.from({ length: 12 }, (_, i) => `/ilan/x-${2000 + i}`);
    const known = new Set(hrefs.map((h) => `arabam-${toId(h)}`));
    expect(pickUnknownArabamHrefs(hrefs, toId, known)).toEqual([]);
  });
});
