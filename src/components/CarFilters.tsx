"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { brands as fallbackBrands, fuelTypes, transmissions } from "@/lib/seed-data";
import { COLORS } from "@/lib/derive-specs";
import type { ColorOption } from "@/lib/color-counts";


export function CarFilters({
  availableBrands,
  availableCities,
  availableColors,
  brandModels,
}: {
  availableBrands?: string[];
  availableCities?: string[];
  availableColors?: ColorOption[];
  brandModels?: Record<string, string[]>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const brands =
    availableBrands && availableBrands.length > 0 ? availableBrands : fallbackBrands;
  const cities = availableCities || [];
  const [brand, setBrand] = useState(searchParams.get("brand") || "");
  const [model, setModel] = useState(searchParams.get("model") || "");
  const models = (brand && brandModels?.[brand]) || [];

  const colors =
    availableColors && availableColors.length > 0
      ? availableColors
      : COLORS.map((color) => ({ color, count: 0 }));

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim()) {
        params.set(key, value.trim());
      }
    }

    router.push(`/?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-5 md:p-6">
      <div className="flex items-center gap-3">
        <span className="stat-tile-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 6h16M7 12h10M10.5 18h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Arama ve filtreler</h2>
          <p className="text-sm text-slate-500">Marka, model, şehir, yıl ve fiyat kriterlerine göre filtrele.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="label" htmlFor="q">
            Anahtar kelime
          </label>
          <input
            id="q"
            name="q"
            defaultValue={searchParams.get("q") || ""}
            className="input"
            placeholder="Toyota, Civic, İstanbul..."
          />
        </div>

        <div>
          <label className="label" htmlFor="brand">
            Marka
          </label>
          <select
            id="brand"
            name="brand"
            value={brand}
            onChange={(event) => {
              setBrand(event.target.value);
              setModel("");
            }}
            className="select"
          >
            <option value="">Tümü</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="model">
            Model
          </label>
          <select
            id="model"
            name="model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="select"
            disabled={!brand || models.length === 0}
          >
            <option value="">{brand ? "Tümü" : "Önce marka seçin"}</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="city">
            Şehir
          </label>
          <select
            id="city"
            name="city"
            defaultValue={searchParams.get("city") || ""}
            className="select"
          >
            <option value="">Tümü</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="sort">
            Sıralama
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={searchParams.get("sort") || "mixed"}
            className="select"
          >
            <option value="mixed">Karışık (önerilen)</option>
            <option value="newest">En yeni</option>
            <option value="price_asc">Fiyat (artan)</option>
            <option value="price_desc">Fiyat (azalan)</option>
            <option value="year_desc">Yıl (yeni → eski)</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="yearMin">
            Min yıl
          </label>
          <input
            id="yearMin"
            name="yearMin"
            type="number"
            defaultValue={searchParams.get("yearMin") || ""}
            className="input"
            placeholder="2015"
          />
        </div>

        <div>
          <label className="label" htmlFor="yearMax">
            Max yıl
          </label>
          <input
            id="yearMax"
            name="yearMax"
            type="number"
            defaultValue={searchParams.get("yearMax") || ""}
            className="input"
            placeholder="2024"
          />
        </div>

        <div>
          <label className="label" htmlFor="priceMin">
            Min fiyat
          </label>
          <input
            id="priceMin"
            name="priceMin"
            type="number"
            defaultValue={searchParams.get("priceMin") || ""}
            className="input"
            placeholder="500000"
          />
        </div>

        <div>
          <label className="label" htmlFor="priceMax">
            Max fiyat
          </label>
          <input
            id="priceMax"
            name="priceMax"
            type="number"
            defaultValue={searchParams.get("priceMax") || ""}
            className="input"
            placeholder="2000000"
          />
        </div>

        <div>
          <label className="label" htmlFor="fuelType">
            Yakıt
          </label>
          <select
            id="fuelType"
            name="fuelType"
            defaultValue={searchParams.get("fuelType") || ""}
            className="select"
          >
            <option value="">Tümü</option>
            {fuelTypes.map((fuel) => (
              <option key={fuel} value={fuel}>
                {fuel}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="transmission">
            Vites
          </label>
          <select
            id="transmission"
            name="transmission"
            defaultValue={searchParams.get("transmission") || ""}
            className="select"
          >
            <option value="">Tümü</option>
            {transmissions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="color">
            Renk
          </label>
          <select
            id="color"
            name="color"
            defaultValue={searchParams.get("color") || ""}
            className="select"
          >
            <option value="">Tümü</option>
            {colors.map(({ color, count }) => (
              <option key={color} value={color}>
                {count > 0 ? `${color} (${count})` : color}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-white/5 pt-4">
        <button type="submit" className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="m20 20-3.8-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Ara
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => router.push("/")}
        >
          Temizle
        </button>
      </div>
    </form>
  );
}
