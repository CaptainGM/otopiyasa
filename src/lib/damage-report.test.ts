import { describe, expect, it } from "vitest";
import { parseDamageReport, damageLevelLabel } from "@/lib/damage-report";


describe("parseDamageReport", () => {
  it("tamamı orijinal", () => {
    const r = parseDamageReport("Tamamı orjinal");
    expect(r.allOriginal).toBe(true);
    expect(r.level).toBe("original");
    expect(r.affected).toBe(0);
  });

  it("belirtilmemiş / boş", () => {
    expect(parseDamageReport("Belirtilmemiş").unknown).toBe(true);
    expect(parseDamageReport("").unknown).toBe(true);
    expect(parseDamageReport(undefined).unknown).toBe(true);
    expect(parseDamageReport(null).level).toBe("unknown");
  });

  it("tek sayı kalıpları", () => {
    expect(parseDamageReport("1 boyalı").painted).toBe(1);
    expect(parseDamageReport("3 boyalı").painted).toBe(3);
    expect(parseDamageReport("1 değişen").changed).toBe(1);
    expect(parseDamageReport("12 boyalı").painted).toBe(12);
  });

 
  it("lokal boyalı, normal boyalı ile karışmaz", () => {
    const r = parseDamageReport("1 lokal boyalı");
    expect(r.localPainted).toBe(1);
    expect(r.painted).toBe(0);

    const r2 = parseDamageReport("2 boyalı, 1 lokal boyalı");
    expect(r2.painted).toBe(2);
    expect(r2.localPainted).toBe(1);
    expect(r2.affected).toBe(3);
  });

  it("bileşik kalıplar", () => {
    const r = parseDamageReport("1 değişen, 3 boyalı");
    expect(r).toMatchObject({ changed: 1, painted: 3, localPainted: 0, affected: 4 });

    const r2 = parseDamageReport("1 değişen, 1 boyalı, 3 lokal boyalı");
    expect(r2).toMatchObject({ changed: 1, painted: 1, localPainted: 3, affected: 5 });

    const r3 = parseDamageReport("1 değişen, 10 boyalı, 2 lokal boyalı");
    expect(r3).toMatchObject({ changed: 1, painted: 10, localPainted: 2, affected: 13 });
  });

  it("tamamı boyalı ağır sayılır", () => {
    const r = parseDamageReport("Tamamı boyalı");
    expect(r.level).toBe("heavy");
    expect(r.allOriginal).toBe(false);
  });

  it("ağırlık seviyesi: değişen > boyalı > lokal", () => {
    
    expect(parseDamageReport("1 lokal boyalı").level).toBe("light");
   
    expect(parseDamageReport("1 değişen, 1 boyalı").level).toBe("moderate");
    
    expect(parseDamageReport("4 değişen, 2 boyalı").level).toBe("heavy");
  });

  it("özet cümlesi okunabilir", () => {
    expect(parseDamageReport("1 değişen, 3 boyalı").summary).toBe(
      "1 değişen, 3 boyalı parça bildirilmiş."
    );
  });

  it("seviye etiketleri Türkçe", () => {
    expect(damageLevelLabel("original")).toBe("Tamamı orijinal");
    expect(damageLevelLabel("heavy")).toBe("Yoğun işlem görmüş");
  });
});
