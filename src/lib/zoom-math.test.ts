import { describe, expect, it } from "vitest";
import {
  centroidOf,
  clampScale,
  clampView,
  DOUBLE_TAP_SCALE,
  identityView,
  MAX_SCALE,
  MIN_SCALE,
  panView,
  pinchView,
  settleView,
  spreadOf,
  zoomAround,
  type Point,
  type View,
} from "./zoom-math";

/** Alan koordinatında bir noktanın, görünüm uygulandıktan sonra nerede olduğu (merkeze göre, transform-origin: center). */
const onScreen = (view: View, imagePoint: Point): Point => ({
  x: view.x + view.scale * imagePoint.x,
  y: view.y + view.scale * imagePoint.y,
});

describe("clampScale", () => {
  it("ölçeği 1 ile 4 arasında tutar", () => {
    expect(clampScale(0.2)).toBe(MIN_SCALE);
    expect(clampScale(9)).toBe(MAX_SCALE);
    expect(clampScale(2)).toBe(2);
  });
});

describe("zoomAround", () => {
  it("odak noktasının altındaki fotoğraf noktası yerinde kalır", () => {
    const view: View = { scale: 1.5, x: -30, y: 12 };
    const focal: Point = { x: 80, y: -40 };
    const imagePoint = { x: (focal.x - view.x) / view.scale, y: (focal.y - view.y) / view.scale };
    const next = zoomAround(view, focal, 3);
    const moved = onScreen(next, imagePoint);
    expect(moved.x).toBeCloseTo(focal.x, 6);
    expect(moved.y).toBeCloseTo(focal.y, 6);
  });

  it("ölçeği sınırların dışına taşırmaz", () => {
    expect(zoomAround(identityView(), { x: 0, y: 0 }, 10).scale).toBe(MAX_SCALE);
    expect(zoomAround({ scale: 2, x: 0, y: 0 }, { x: 0, y: 0 }, 0.5).scale).toBe(MIN_SCALE);
  });
});

describe("pinchView", () => {
  it("parmak aralığı iki katına çıkınca ölçek iki katına çıkar ve odak yerinde kalır", () => {
    const base = identityView();
    const focal: Point = { x: 20, y: 10 };
    const next = pinchView(base, focal, 100, focal, 200);
    expect(next.scale).toBeCloseTo(2, 6);
    // Odağın altındaki fotoğraf noktası (20, 10) hâlâ odakta olmalı.
    const under = onScreen(next, { x: 20, y: 10 });
    expect(under.x).toBeCloseTo(focal.x, 6);
    expect(under.y).toBeCloseTo(focal.y, 6);
  });

  it("odak kaysa bile görüntü odağı izler (iki parmakla birlikte kaydırma)", () => {
    const next = pinchView(identityView(), { x: 0, y: 0 }, 100, { x: 50, y: 0 }, 100);
    expect(next.scale).toBe(1);
    expect(next.x).toBeCloseTo(50, 6);
  });

  it("başlangıç aralığı sıfırsa görünüm değişmez", () => {
    const base: View = { scale: 2, x: 5, y: 5 };
    expect(pinchView(base, { x: 0, y: 0 }, 0, { x: 0, y: 0 }, 100)).toEqual(base);
  });
});

describe("panView, clampView, settleView", () => {
  it("tek parmak öteleme odak farkı kadar kaydırır", () => {
    expect(panView({ scale: 2, x: -10, y: -10 }, { x: 0, y: 0 }, { x: 15, y: -5 })).toEqual({ scale: 2, x: 5, y: -15 });
  });

  it("öteleme, fotoğrafın kenarı alanın kenarını geçmeyecek kadar sınırlanır", () => {
    const image = { width: 300, height: 200 };
    const stage = { width: 400, height: 300 };
    // 2x: genişlik 600, alan 400 → yatayda en fazla 100 px kaydırılabilir.
    expect(clampView({ scale: 2, x: 500, y: -500 }, image, stage)).toEqual({ scale: 2, x: 100, y: -50 });
    // 1x: fotoğraf alandan küçük, hiç kaydırılmaz.
    expect(clampView({ scale: 1, x: 30, y: 30 }, image, stage)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("parmaklar kalkınca neredeyse 1x olan görünüm normal boyuta döner", () => {
    expect(settleView({ scale: 1.02, x: 9, y: 9 })).toEqual(identityView());
    expect(settleView({ scale: 1.5, x: 9, y: 9 })).toEqual({ scale: 1.5, x: 9, y: 9 });
  });
});

describe("spreadOf, centroidOf, çift dokunuş hedefi", () => {
  it("iki nokta arasındaki uzaklık ve ortası", () => {
    expect(spreadOf({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(centroidOf([{ x: 0, y: 0 }, { x: 10, y: 20 }])).toEqual({ x: 5, y: 10 });
  });

  it("çift dokunuş hedefi yakınlaştırmalı ama sınırın içinde", () => {
    expect(DOUBLE_TAP_SCALE).toBeGreaterThan(MIN_SCALE);
    expect(DOUBLE_TAP_SCALE).toBeLessThan(MAX_SCALE);
  });
});
