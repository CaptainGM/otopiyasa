import { describe, expect, it } from "vitest";
import { planPopularRecent, POPULAR_FAMILY_MIN, RECENT_ROUND_CAP } from "./popular-recent";

const fam = (brand: string, label: string, total: number, recent: number) => ({
  brand,
  familyKey: label.toLowerCase().replace(/\s+/g, ""),
  label,
  total,
  recent,
});

describe("planPopularRecent", () => {
  it("yalnızca popüler aileleri alır (en az 100 ilan)", () => {
    const plan = planPopularRecent([fam("Fiat", "Egea", POPULAR_FAMILY_MIN, 10), fam("Fiat", "Uno", POPULAR_FAMILY_MIN - 1, 0)], 150, 10);
    expect(plan.map((p) => p.label)).toEqual(["Egea"]);
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

  it("en az ilanlı aile önce gelir (popülere doğru) ve maxFamilies uygulanır", () => {
    const plan = planPopularRecent([fam("A", "Küçük", 120, 0), fam("B", "Büyük", 500, 0), fam("C", "Orta", 200, 0)], 150, 2);
    expect(plan.map((p) => p.label)).toEqual(["Küçük", "Orta"]);
  });

  it("bekleme listesindeki aileyi bu turda atlar", () => {
    const f = fam("Toyota", "Corolla", 447, 0);
    const plan = planPopularRecent([f], 150, 10, new Set([`Toyota::${f.familyKey}`]));
    expect(plan).toEqual([]);
  });
});
