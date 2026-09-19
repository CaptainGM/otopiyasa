"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { MapCluster } from "@/lib/map-clusters";
import { distanceKm, prettyDistrict } from "@/lib/map-clusters";
import { MapVehicleDrawer } from "@/components/MapVehicleDrawer";
import { FormattedNumberInput } from "@/components/FormattedNumberInput";

const ListingsMapInner = dynamic(() => import("@/components/ListingsMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-280px)] min-h-[520px] w-full items-center justify-center rounded-2xl border border-white/10 bg-[#0c121d]/70 text-slate-400 backdrop-blur-md">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-3 border-amber-400/40 border-t-amber-400" />
        <span className="text-xs font-semibold text-slate-400">Harita yükleniyor…</span>
      </div>
    </div>
  ),
});

interface Options {
  brands: string[];
  cities: string[];
  fuels: string[];
}

const RADIUS_OPTIONS = [10, 25, 50, 100];
const DEFAULT_RADIUS_KM = 25;

export function ListingsMap() {
  const [brand, setBrand] = useState("");
  const [city, setCity] = useState("");
  const [fuel, setFuel] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [discountOnly, setDiscountOnly] = useState(false);

  const [clusters, setClusters] = useState<MapCluster[]>([]);
  const [options, setOptions] = useState<Options>({ brands: [], cities: [], fuels: [] });
  const [total, setTotal] = useState(0);
  const [unmapped, setUnmapped] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "asking" | "denied" | "unsupported">("idle");
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);

  // Selected cluster for Drawer
  const [selectedCluster, setSelectedCluster] = useState<MapCluster | null>(null);
  const [isWholeCity, setIsWholeCity] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (brand) params.set("brand", brand);
    if (city) params.set("city", city);
    if (fuel) params.set("fuel", fuel);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (discountOnly) params.set("discountOnly", "true");
    return params;
  }, [brand, city, fuel, minPrice, maxPrice, discountOnly]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/map?${filterParams()}`);
        if (!res.ok) throw new Error("İstek başarısız");
        const data = await res.json();
        if (id !== requestId.current) return;
        setClusters(data.clusters || []);
        setTotal(data.total || 0);
        setUnmapped(data.unmapped || 0);
        if (data.options) setOptions(data.options);
      } catch {
        if (id === requestId.current) setError("Harita verisi alınamadı.");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [filterParams]);

  function askLocation() {
    if (!("geolocation" in navigator)) {
      setGeoState("unsupported");
      return;
    }
    setGeoState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState("idle");
        setNearbyOnly(true);
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 }
    );
  }

  function handleSelectCluster(cluster: MapCluster, wholeCity: boolean) {
    setSelectedCluster(cluster);
    setIsWholeCity(wholeCity);
    setIsDrawerOpen(true);
  }

  function clearFilters() {
    setBrand("");
    setCity("");
    setFuel("");
    setMinPrice("");
    setMaxPrice("");
    setDiscountOnly(false);
  }

  const hasActiveFilters = Boolean(brand || city || fuel || minPrice || maxPrice || discountOnly);

  const withDistance: (MapCluster & { distance: number | null })[] = me
    ? clusters
        .map((c) => ({ ...c, distance: distanceKm(me, c) }))
        .sort((a, b) => a.distance - b.distance)
    : clusters.map((c) => ({ ...c, distance: null }));

  const visible =
    nearbyOnly && me
      ? withDistance.filter(
          (c) => c.level === "district" && (c.distance ?? Infinity) <= radiusKm
        )
      : withDistance;

  const shownCount = visible.reduce((sum, c) => sum + c.count, 0);

  const hiddenApprox =
    nearbyOnly && me
      ? withDistance
          .filter((c) => c.level === "province" && (c.distance ?? Infinity) <= radiusKm)
          .reduce((sum, c) => sum + c.count, 0)
      : 0;

  const nearest = me && withDistance.length > 0 ? withDistance[0] : null;

  const selectCls =
    "select rounded-xl border border-white/10 bg-[#0e1626]/80 px-3 py-2 text-xs font-medium text-slate-200 focus:border-amber-400/50 focus:outline-none";
  const inputCls =
    "input w-28 rounded-xl border border-white/10 bg-[#0e1626]/80 px-3 py-2 text-xs font-medium text-slate-200 focus:border-amber-400/50 focus:outline-none";

  return (
    <div className="space-y-4">
      {/* Modern Filter Header */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0f18]/80 p-4 shadow-xl backdrop-blur-md space-y-3.5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs text-slate-400">
            <span className="block font-bold uppercase tracking-wider text-[10px]">Marka</span>
            <select className={selectCls} value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">Tüm Markalar</option>
              {options.brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-400">
            <span className="block font-bold uppercase tracking-wider text-[10px]">Şehir</span>
            <select className={selectCls} value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Tüm Şehirler</option>
              {options.cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-400">
            <span className="block font-bold uppercase tracking-wider text-[10px]">Yakıt</span>
            <select className={selectCls} value={fuel} onChange={(e) => setFuel(e.target.value)}>
              <option value="">Tümü</option>
              {options.fuels.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-400">
            <span className="block font-bold uppercase tracking-wider text-[10px]">Min Fiyat</span>
            <div className="w-32">
              <FormattedNumberInput
                className={inputCls}
                placeholder="0 ₺"
                value={minPrice}
                onChange={(raw) => setMinPrice(raw)}
              />
            </div>
          </label>

          <label className="space-y-1 text-xs text-slate-400">
            <span className="block font-bold uppercase tracking-wider text-[10px]">Max Fiyat</span>
            <div className="w-32">
              <FormattedNumberInput
                className={inputCls}
                placeholder="∞ ₺"
                value={maxPrice}
                onChange={(raw) => setMaxPrice(raw)}
              />
            </div>
          </label>

          {/* Fiyatı Düşenler Toggle Button */}
          <button
            type="button"
            onClick={() => setDiscountOnly(!discountOnly)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              discountOnly
                ? "border border-amber-400/60 bg-amber-400/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                : "border border-white/10 bg-[#0e1626]/80 text-slate-400 hover:border-amber-400/40 hover:text-amber-200"
            }`}
          >
            <span>🔥</span>
            <span>Fiyatı Düşenler</span>
            {discountOnly && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-300 underline py-2"
            >
              Filtreleri Temizle
            </button>
          )}

          {/* Live Stats Badge */}
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-300" />
                Güncelleniyor…
              </span>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  <strong className="text-amber-300 font-bold">{shownCount.toLocaleString("tr-TR")}</strong> aktif ilan •{" "}
                  <span className="text-slate-300">{visible.length}</span> konum
                  {unmapped > 0 && ` (${unmapped} ilçe detaysız)`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Location & Radius Sub-bar */}
        <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-3">
          {!me ? (
            <>
              <button
                type="button"
                onClick={askLocation}
                className="btn btn-secondary text-xs font-bold py-1.5 px-3"
                disabled={geoState === "asking"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" stroke="currentColor" strokeWidth="2" />
                  <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
                </svg>
                {geoState === "asking" ? "Konum alınıyor…" : "Konumuma Yakın İlanlar"}
              </button>
              <span className="text-[11px] text-slate-500">
                {geoState === "denied"
                  ? "Konum izni verilmedi — tarayıcı ayarlarından açabilirsin."
                  : geoState === "unsupported"
                  ? "Tarayıcın konum servisini desteklemiyor."
                  : "Konumun yalnızca tarayıcında filtrelenir, sunucuya aktarılmaz."}
              </span>
            </>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={nearbyOnly}
                  onChange={(e) => setNearbyOnly(e.target.checked)}
                  className="h-4 w-4 accent-amber-400 rounded"
                />
                Sadece yakınımdakiler
              </label>

              {nearbyOnly && (
                <select
                  className={selectCls}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  aria-label="Arama yarıçapı"
                >
                  {RADIUS_OPTIONS.map((km) => (
                    <option key={km} value={km}>{km} km yarıçap</option>
                  ))}
                </select>
              )}

              {nearbyOnly && hiddenApprox > 0 && (
                <span className="text-[11px] text-slate-500">
                  {hiddenApprox} ilan gizlendi (ilçesi bilinmediğinden yakınlık ölçülemiyor)
                </span>
              )}

              {nearest && nearest.distance !== null && (
                <span className="text-[11px] text-slate-400">
                  En yakın ilan bölgesi:{" "}
                  <strong className="text-slate-200">
                    {nearest.city}
                    {nearest.district ? ` / ${prettyDistrict(nearest.district)}` : ""}
                  </strong>{" "}
                  — {nearest.distance.toFixed(0)} km
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  setMe(null);
                  setNearbyOnly(false);
                }}
                className="text-[11px] text-slate-500 underline hover:text-slate-300 ml-auto"
              >
                konumu unut
              </button>
            </>
          )}
        </div>

        {error && <p className="text-xs text-rose-300">{error}</p>}
      </div>

      {/* Map Canvas and Interactive Vehicle Drawer */}
      <div className="relative">
        <ListingsMapInner
          clusters={visible}
          me={me}
          filterQuery={filterParams().toString()}
          nearby={nearbyOnly && me ? { ...me, radiusKm: radiusKm } : null}
          selectedKey={selectedCluster?.key || null}
          onSelectCluster={handleSelectCluster}
        />

        {/* Slide-Out Vehicle Drawer */}
        <MapVehicleDrawer
          cluster={selectedCluster}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedCluster(null);
          }}
          filterQuery={filterParams().toString()}
          isWholeCity={isWholeCity}
          nearby={nearbyOnly && me ? { ...me, radiusKm: radiusKm } : null}
        />
      </div>
    </div>
  );
}
