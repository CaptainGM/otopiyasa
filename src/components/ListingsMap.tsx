"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { MapCluster } from "@/lib/map-clusters";
import { distanceKm, prettyDistrict } from "@/lib/map-clusters";


const ListingsMapInner = dynamic(() => import("@/components/ListingsMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-320px)] min-h-[440px] w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400">
      Harita yükleniyor…
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

  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (brand) params.set("brand", brand);
    if (city) params.set("city", city);
    if (fuel) params.set("fuel", fuel);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    return params;
  }, [brand, city, fuel, minPrice, maxPrice]);

  
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

  const selectCls = "select rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm";
  const inputCls = "input w-28 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs text-slate-500">
            <span className="block font-bold uppercase tracking-wider">Marka</span>
            <select className={selectCls} value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">Tümü</option>
              {options.brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-500">
            <span className="block font-bold uppercase tracking-wider">Şehir</span>
            <select className={selectCls} value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Tümü</option>
              {options.cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-500">
            <span className="block font-bold uppercase tracking-wider">Yakıt</span>
            <select className={selectCls} value={fuel} onChange={(e) => setFuel(e.target.value)}>
              <option value="">Tümü</option>
              {options.fuels.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-500">
            <span className="block font-bold uppercase tracking-wider">Min fiyat</span>
            <input className={inputCls} type="number" placeholder="0" value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)} />
          </label>

          <label className="space-y-1 text-xs text-slate-500">
            <span className="block font-bold uppercase tracking-wider">Max fiyat</span>
            <input className={inputCls} type="number" placeholder="∞" value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)} />
          </label>

          <p className="ml-auto text-sm text-slate-400">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-300" />
                Yükleniyor…
              </span>
            ) : (
              <>
                <strong className="text-amber-300">{shownCount}</strong> ilan •{" "}
                {visible.length} konum
                {unmapped > 0 && ` • ${unmapped} ilan haritalanamadı`}
              </>
            )}
          </p>
        </div>

       
        <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-3">
          {!me ? (
            <>
              <button type="button" onClick={askLocation} className="btn btn-secondary text-sm"
                disabled={geoState === "asking"}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                {geoState === "asking" ? "Konum alınıyor…" : "Konumuma yakın ilanlar"}
              </button>
              <span className="text-xs text-slate-500">
                {geoState === "denied"
                  ? "Konum izni verilmedi — tarayıcı ayarlarından açabilirsin."
                  : geoState === "unsupported"
                    ? "Tarayıcın konum servisini desteklemiyor."
                    : "Konumun yalnızca tarayıcında kullanılır, sunucuya gönderilmez."}
              </span>
            </>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={nearbyOnly}
                  onChange={(e) => setNearbyOnly(e.target.checked)}
                  className="h-4 w-4 accent-amber-400" />
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
                    <option key={km} value={km}>{km} km</option>
                  ))}
                </select>
              )}
              {nearbyOnly && hiddenApprox > 0 && (
                <span className="text-xs text-slate-500">
                  {hiddenApprox} ilan gizlendi (ilçesi bilinmiyor, yakınlık ölçülemiyor)
                </span>
              )}
              {nearest && nearest.distance !== null && (
                <span className="text-xs text-slate-500">
                  En yakın ilan grubu:{" "}
                  <strong className="text-slate-300">
                    {nearest.city}
                    {nearest.district ? ` / ${prettyDistrict(nearest.district)}` : ""}
                  </strong>{" "}
                  — {nearest.distance.toFixed(0)} km
                </span>
              )}
              <button type="button" onClick={() => { setMe(null); setNearbyOnly(false); }}
                className="text-xs text-slate-500 underline hover:text-slate-300">
                konumu unut
              </button>
            </>
          )}
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>

      <ListingsMapInner
        clusters={visible}
        me={me}
        filterQuery={filterParams().toString()}
        nearby={nearbyOnly && me ? { ...me, radiusKm: radiusKm } : null}
      />
    </div>
  );
}
