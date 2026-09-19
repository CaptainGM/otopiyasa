"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatNumber, formatPrice } from "@/lib/utils";
import { CAR_PLACEHOLDER_SRC } from "@/components/CarThumb";
import { FallbackImage } from "@/components/FallbackImage";
import { CARD_IMAGE_SIZE } from "@/lib/image-url";
import { SourceBadge } from "@/components/SourceBadge";
import type { MapCluster } from "@/lib/map-clusters";
import { prettyDistrict } from "@/lib/map-clusters";
import type { ListingSource } from "@/types";

export interface DrawerCar {
  _id: string;
  title: string;
  brand: string;
  model?: string;
  year: number;
  price: number;
  mileage: number;
  city: string;
  address?: string;
  imageUrl: string;
  sourceSite: string;
  fuelType: string;
  transmission: string;
  hasDropped?: boolean;
  dropAmount?: number;
}

interface MapVehicleDrawerProps {
  cluster: MapCluster | null;
  isOpen: boolean;
  onClose: () => void;
  filterQuery: string;
  isWholeCity?: boolean;
  nearby?: { lat: number; lng: number; radiusKm: number } | null;
}

export function MapVehicleDrawer({
  cluster,
  isOpen,
  onClose,
  filterQuery,
  isWholeCity = false,
  nearby,
}: MapVehicleDrawerProps) {
  const [cars, setCars] = useState<DrawerCar[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<"price_asc" | "price_desc" | "year_desc" | "mileage_asc">("price_asc");
  const [search, setSearch] = useState("");

  const clusterKey = cluster?.key || "";

  useEffect(() => {
    if (!cluster || !isOpen) return;

    let cancelled = false;
    setLoading(true);
    setError(false);
    setSearch("");

    const params = new URLSearchParams(filterQuery);
    params.set("key", cluster.key);
    params.set("sort", sort);
    if (isWholeCity) params.set("scope", "city");
    if (nearby) {
      params.set("near", `${nearby.lat},${nearby.lng}`);
      params.set("radiusKm", String(nearby.radiusKm));
    }

    fetch(`/api/map/cars?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("İlanlar alınamadı");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setCars(data.items || []);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clusterKey, isOpen, sort, filterQuery, isWholeCity, nearby]);

  const filteredCars = useMemo(() => {
    if (!cars) return [];
    if (!search.trim()) return cars;
    const q = search.toLowerCase().trim();
    return cars.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.brand.toLowerCase().includes(q) ||
        (c.model && c.model.toLowerCase().includes(q)) ||
        c.fuelType.toLowerCase().includes(q) ||
        c.transmission.toLowerCase().includes(q)
    );
  }, [cars, search]);

  if (!isOpen || !cluster) return null;

  const clusterTitle = cluster.district
    ? `${cluster.city} / ${prettyDistrict(cluster.district)}`
    : isWholeCity
    ? `${cluster.city} (İl Geneli)`
    : `${cluster.city} (Merkez / Genel)`;

  return (
    <aside
      className="fixed inset-y-0 right-0 z-[1000] flex w-full flex-col border-l border-white/10 bg-[#0c121d]/95 shadow-2xl backdrop-blur-xl transition-all duration-300 sm:w-[440px] md:w-[480px] lg:w-[500px]"
      aria-label="Bölgedeki İlanlar"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-white/10 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400/20 text-amber-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              </span>
              <h2 className="text-lg font-black tracking-tight text-white">{clusterTitle}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-amber-400">{cluster.count} İlan Bulundu</span>
              {cluster.minPrice > 0 && (
                <>
                  <span>•</span>
                  <span>En Düşük: <strong className="text-emerald-400">{formatPrice(cluster.minPrice)}</strong></span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            title="Kapat"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter & Sort Bar */}
        <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-12">
          <div className="relative sm:col-span-7">
            <input
              type="text"
              placeholder="Bu bölgede ara (ör. Clio)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-slate-300 focus:border-amber-400/50 focus:outline-none sm:col-span-5"
          >
            <option value="price_asc">Fiyat: Artan</option>
            <option value="price_desc">Fiyat: Azalan</option>
            <option value="year_desc">Model: En Yeni</option>
            <option value="mileage_asc">KM: En Düşük</option>
          </select>
        </div>
      </div>

      {/* Vehicle List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-9 w-9 animate-spin rounded-full border-3 border-amber-400/30 border-t-amber-400" />
            <p className="mt-4 text-xs font-semibold text-slate-400">Bölgedeki araçlar listeleniyor...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-sm text-rose-300">
            <p>İlanlar yüklenirken bir sorun oluştu.</p>
            <button
              type="button"
              onClick={() => setSort(sort)}
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
            >
              Tekrar Dene
            </button>
          </div>
        ) : filteredCars.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <p className="text-sm font-semibold">Eşleşen ilan bulunamadı.</p>
            {search && (
              <p className="mt-1 text-xs text-slate-600">Arama filtresini temizlemeyi deneyin.</p>
            )}
          </div>
        ) : (
          filteredCars.map((car) => (
            <Link
              key={car._id}
              href={`/cars/${car._id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-3.5 rounded-xl border border-white/5 bg-white/[0.03] p-3 transition duration-150 hover:border-amber-400/40 hover:bg-white/[0.06]"
            >
              {/* Image */}
              <div className="relative h-22 w-32 flex-shrink-0 overflow-hidden rounded-lg bg-slate-900">
                <FallbackImage
                  src={car.imageUrl}
                  alt={car.title}
                  preferSize={CARD_IMAGE_SIZE}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  fallback={<img src={CAR_PLACEHOLDER_SRC} alt="" className="h-full w-full object-cover opacity-60" />}
                />
                <div className="absolute top-1 left-1">
                  <SourceBadge source={car.sourceSite as ListingSource} />
                </div>
              </div>

              {/* Details */}
              <div className="flex flex-1 flex-col justify-between min-w-0">
                <div>
                  <h3 className="line-clamp-1 text-xs font-bold text-slate-200 group-hover:text-amber-300 transition">
                    {car.title}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {car.year} • {formatNumber(car.mileage)} km • {car.fuelType}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {car.transmission} {car.address ? `• ${car.address}` : ""}
                  </p>
                </div>

                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <div className="flex flex-col">
                    {car.hasDropped && car.dropAmount && car.dropAmount > 0 && (
                      <span className="text-[10px] font-bold text-emerald-400">
                        ↓ {formatPrice(car.dropAmount)} indirim
                      </span>
                    )}
                    <span className="text-sm font-extrabold text-amber-300">
                      {formatPrice(car.price)}
                    </span>
                  </div>

                  <span className="flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 group-hover:text-amber-400">
                    İncele
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="border-t border-white/10 px-4 py-2.5 text-center text-[11px] text-slate-500">
        İlanlar yeni sekmede açılır • Harita konumu korunur
      </div>
    </aside>
  );
}
