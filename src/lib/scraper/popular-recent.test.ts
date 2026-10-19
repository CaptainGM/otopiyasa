import { describe, expect, it } from "vitest";
import { planPopularRecent, RECENT_ROUND_CAP } from "./popular-recent";

const fam = (brand: string, label: string, total: number, recent: number) => ({
  brand,
  familyKey: label.toLowerCase().replace(/\s+/g, ""),
  label,
  total,
  recent,
});

describe("planPopularRecent", () => {
  it("hiç ilanı olmayan aileyi de alır ve önce koyar (Ioniq 5N örneği)", () => {
    const plan = planPopularRecent([fam("Hyundai", "Kona", 300, 40), fam("Hyundai", "IONIQ 5N", 0, 0)], 150, 10);
    expect(plan[0].label).toBe("IONIQ 5N");
  });

  it("2020 ve sonrası ilan sayısı az olan önce gelir, toplam sayıya bakılmaz", () => {
    const plan = planPopularRecent([fam("A", "Büyük", 500, 80), fam("B", "Küçük", 60, 5)], 150, 10);
    expect(plan.map((p) => p.label)).toEqual(["Küçük", "Büyük"]);
  });

  it("yeni nesil sayısı eşitse toplamı az olan önce gelir", () => {
    const plan = planPopularRecent([fam("A", "Orta", 200, 10), fam("A", "Az", 40, 10)], 150, 10);
    expect(plan.map((p) => p.label)).toEqual(["Az", "Orta"]);
  });

  it("eşitlikte az ilanlı markanın (Porsche) modeli, kalabalık markanın (Hyundai) modelinden önce gelir", () => {
    const plan = planPopularRecent(
      [fam("Hyundai", "Yeni", 9000, 500), fam("Hyundai", "X", 0, 0), fam("Porsche", "Y", 0, 0)],
      150,
      10
    );
    expect(plan.map((p) => p.label)).toEqual(["Y", "X"]);
  });

  it("hedefi zaten tutturan aileyi atlar", () => {
    const plan = planPopularRecent([fam("Renault", "Clio", 300, 150)], 150, 10);
    expect(plan).toEqual([]);
  });

  it("eksik kadar ve tur başına üst sınıra kadar çeker", () => {
    const plan = planPopularRecent([fam("Renault", "Clio", 300, 20)], 150, 10);
    expect(plan[0].quota).toBe(RECENT_ROUND_CAP);
    const small = planPopularRecent([fam("Renault", "Clio", 300, 120)], 150, 10);
    expect(small[0].quota).toBe(30);
  });

  it("maxFamilies tur başına kaç aile alınacağını sınırlar", () => {
    const plan = planPopularRecent([fam("A", "Bir", 10, 0), fam("B", "İki", 20, 0), fam("C", "Üç", 30, 0)], 150, 2);
    expect(plan).toHaveLength(2);
  });

  it("bekleme listesindeki aileyi bu turda atlar", () => {
    const f = fam("Toyota", "Corolla", 447, 0);
    const plan = planPopularRecent([f], 150, 10, new Set([`Toyota::${f.familyKey}`]));
    expect(plan).toEqual([]);
  });

  it("tur tavanı verilirse aile başına kota ona göre sınırlanır (tam çekimde büyük aileler için)", () => {
    const plan = planPopularRecent([fam("Renault", "Clio", 900, 20)], 1000, 10, new Set(), 400);
    expect(plan[0].quota).toBe(400);
  });
});
