import { describe, expect, it } from "vitest";
import { cityToCoords, spreadAroundCity } from "@/lib/city-coords";

describe("cityToCoords", () => {
  it("Türkçe karakterli şehir adlarını çözer", () => {
    expect(cityToCoords("İstanbul")).toEqual({ lat: 41.0082, lng: 28.9784 });
    expect(cityToCoords("izmir")).toEqual({ lat: 38.4237, lng: 27.1428 });
    expect(cityToCoords("ŞANLIURFA")).toEqual({ lat: 37.1591, lng: 38.7969 });
  });

  it("il adını içeren bileşik değerleri eşleştirir", () => {
    expect(cityToCoords("İstanbul / Kartal")).toEqual({ lat: 41.0082, lng: 28.9784 });
  });

  it("bilinmeyen şehirde null döner", () => {
    expect(cityToCoords("Atlantis")).toBeNull();
  });
});

describe("spreadAroundCity", () => {
  const base = { lat: 40, lng: 30 };

  it("ilk ilan tam merkezde kalır", () => {
    expect(spreadAroundCity(base, 0)).toEqual(base);
  });

  it("deterministiktir ve merkeze yakın kalır", () => {
    const first = spreadAroundCity(base, 3);
    const second = spreadAroundCity(base, 3);
    expect(first).toEqual(second);
    expect(Math.abs(first.lat - base.lat)).toBeLessThan(0.2);
    expect(Math.abs(first.lng - base.lng)).toBeLessThan(0.2);
  });

  it("farklı indeksler farklı noktalara düşer", () => {
    expect(spreadAroundCity(base, 1)).not.toEqual(spreadAroundCity(base, 2));
  });
});
