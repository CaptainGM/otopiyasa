import { describe, expect, it, vi } from "vitest";

vi.mock("@/models/Car", () => ({ Car: {} }));

import { pageSlice, pickNearestClusters, rankNearbyCandidates, type NearbyCandidate } from "./nearby";
import type { MapCluster } from "./map-clusters";

const candidate = (id: string, distanceKm: number, price: number, created: number): NearbyCandidate => ({
  id,
  distanceKm,
  approximate: false,
  district: "",
  price,
  created,
});

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

describe("rankNearbyCandidates", () => {
  const items = [
    candidate("a", 4, 900_000, 100),
    candidate("b", 2, 1_500_000, 50),
    candidate("c", 2, 1_200_000, 200),
  ];

  it("mesafede yakından uzağa; eşitlikte en yeni ilan önce", () => {
    expect(rankNearbyCandidates(items, "distance").map((c) => c.id)).toEqual(["c", "b", "a"]);
  });

  it("fiyatta ucuzdan pahalıya ve tersi", () => {
    expect(rankNearbyCandidates(items, "priceAsc").map((c) => c.id)).toEqual(["a", "c", "b"]);
    expect(rankNearbyCandidates(items, "priceDesc").map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("girdiyi değiştirmez", () => {
    const before = items.map((c) => c.id).join();
    rankNearbyCandidates(items, "priceAsc");
    expect(items.map((c) => c.id).join()).toBe(before);
  });
});

describe("pageSlice", () => {
  const all = Array.from({ length: 50 }, (_, i) => i);

  it("sayfa dilimini ve daha var mı bilgisini döner", () => {
    const first = pageSlice(all, 1, 24);
    expect(first.items).toHaveLength(24);
    expect(first.items[0]).toBe(0);
    expect(first.total).toBe(50);
    expect(first.hasMore).toBe(true);
  });

  it("son sayfada hasMore false olur", () => {
    const last = pageSlice(all, 3, 24);
    expect(last.items).toEqual([48, 49]);
    expect(last.hasMore).toBe(false);
  });

  it("listenin ötesindeki sayfa boş ve hasMore false", () => {
    const beyond = pageSlice(all, 9, 24);
    expect(beyond.items).toEqual([]);
    expect(beyond.hasMore).toBe(false);
  });
});
