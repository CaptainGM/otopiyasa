import { describe, expect, it, vi } from "vitest";

vi.mock("@/models/Car", () => ({ Car: {} }));

import { pickNearestClusters } from "./nearby";
import type { MapCluster } from "./map-clusters";

const cluster = (key: string, lat: number, lng: number, count: number): MapCluster => ({
  key,
  city: key.split("|")[0],
  district: key.split("|")[1] || "",
  districtLabel: "",
  lat,
  lng,
  count,
  minPrice: 0,
  level: "district",
});

describe("pickNearestClusters", () => {
  const clusters = [
    cluster("Ankara|cankaya", 39.9, 32.85, 400),
    cluster("İstanbul|kadikoy", 40.99, 29.03, 5),
    cluster("İstanbul|uskudar", 41.02, 29.02, 30),
    cluster("İstanbul|besiktas", 41.04, 29.0, 50),
  ];

  it("yakından uzağa, istenen ilan sayısına ulaşana kadar küme seçer", () => {
    const picked = pickNearestClusters(clusters, { lat: 40.99, lng: 29.03 }, 12);
    expect(picked.map((p) => p.cluster.key)).toEqual(["İstanbul|kadikoy", "İstanbul|uskudar"]);
  });

  it("tek küme yeterliyse yalnızca onu alır", () => {
    const picked = pickNearestClusters(clusters, { lat: 39.9, lng: 32.85 }, 12);
    expect(picked.map((p) => p.cluster.key)).toEqual(["Ankara|cankaya"]);
  });

  it("küme sayısını sınırlar", () => {
    expect(pickNearestClusters(clusters, { lat: 41, lng: 29 }, 10_000, 2)).toHaveLength(2);
  });
});
