import { describe, expect, it } from "vitest";
import { LIST_SWEEP, matchModelPath, pickFamily, sweepRatio } from "./arabam-list-sweep";
import type { ArabamListDoc, ArabamListPage } from "./arabam-list";

const fam = (over: Record<string, unknown>) =>
  ({ key: "k", brand: "Chevrolet", model: "Captiva", unverified: 0, ours: 0, nextPage: 1, pagesFetched: 0, matched: 0, total: null, ...over }) as any;

const now = new Date("2026-10-06T12:00:00Z");

describe("sweepRatio / pickFamily", () => {
  it("kaynakta bizim ilan oranı yüksek olan aileyi seçer", () => {
    const captiva = fam({ key: "captiva", unverified: 300, total: 614 });
    const egea = fam({ key: "egea", unverified: 520, total: 8008 });
    expect(sweepRatio(captiva)).toBeCloseTo(300 / 614);
    expect(pickFamily([egea, captiva], now)?.key).toBe("captiva");
  });

  it("oranı ilan sayfası kontrolünden düşük aileyi taramaz", () => {
    const huge = fam({ key: "x", unverified: 100, total: 100 / (LIST_SWEEP.minRatio / 2) });
    expect(pickFamily([huge], now)).toBeNull();
  });

  it("toplamı bilinmeyen aile yeterince doğrulanmamış ilanı varsa bir kez denenir", () => {
    expect(pickFamily([fam({ key: "yeni", unverified: LIST_SWEEP.minUnverifiedToProbe })], now)?.key).toBe("yeni");
    expect(pickFamily([fam({ key: "az", unverified: LIST_SWEEP.minUnverifiedToProbe - 1 })], now)).toBeNull();
  });

  it("bekleme süresindeki ve plan kaydını seçmez", () => {
    const waiting = fam({ key: "a", unverified: 300, total: 600, skipUntil: new Date(now.getTime() + 1000) });
    const plan = fam({ key: "__plan__", unverified: 999, total: 1000 });
    expect(pickFamily([waiting, plan], now)).toBeNull();
    const expired = fam({ key: "a", unverified: 300, total: 600, skipUntil: new Date(now.getTime() - 1000) });
    expect(pickFamily([expired], now)?.key).toBe("a");
  });
});

describe("matchModelPath", () => {
  const page = (paths: (string | null)[]): ArabamListPage => ({
    docs: paths.map((modelPath, i) => ({ id: String(40000000 + i), modelPath }) as ArabamListDoc),
    total: paths.length,
    totalPages: 1,
    bodyTypes: [],
  });

  it("tüm ilanlar aynı model yolundaysa yolu döndürür", () => {
    expect(matchModelPath(page(["arazi-suv-pick-up/chevrolet-captiva", "arazi-suv-pick-up/chevrolet-captiva"]), "Chevrolet", "Captiva")).toBe(
      "arazi-suv-pick-up/chevrolet-captiva"
    );
  });

  it("markanın genel sayfasına ya da başka modele düşen sayfayı reddeder", () => {
    expect(matchModelPath(page(["otomobil/chevrolet-aveo", "otomobil/chevrolet-cruze"]), "Chevrolet", "Captiva")).toBeNull();
    expect(matchModelPath(page(["otomobil/chevrolet-aveo"]), "Chevrolet", "Captiva")).toBeNull();
    expect(matchModelPath(page([]), "Chevrolet", "Captiva")).toBeNull();
  });

  it("kaynağın kısalttığı model adını kabul eder", () => {
    expect(matchModelPath(page(["otomobil/mercedes-benz-c"]), "Mercedes-Benz", "C Serisi")).toBe("otomobil/mercedes-benz-c");
    expect(matchModelPath(page(["otomobil/bmw-3-serisi"]), "BMW", "3 Serisi")).toBe("otomobil/bmw-3-serisi");
  });

  it("ayrı araç olan kolun sayfası kısa ada düşerse kabul etmez", () => {
    expect(matchModelPath(page(["otomobil/toyota-corolla"]), "Toyota", "Corolla Cross")).toBeNull();
  });
});
