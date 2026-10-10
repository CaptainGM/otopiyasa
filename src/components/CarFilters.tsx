"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { brands as fallbackBrands, fuelTypes, transmissions } from "@/lib/seed-data";
import { COLORS } from "@/lib/derive-specs";
import type { ColorOption } from "@/lib/color-counts";
import { FormattedNumberInput } from "@/components/FormattedNumberInput";
import { VEHICLE_CLASSES } from "@/lib/vehicle-scope";
import { Icon } from "@/components/Icon";


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
  // Gelişmiş filtrelerden biri seçiliyse katlanmış bölüm açık gelsin (seçili değer görünür kalsın).
  const hasAdvanced = ["sort", "yearMin", "yearMax", "priceMin", "priceMax", "fuelType", "vehicleClass", "transmission", "color"].some(
    (key) => !!searchParams.get(key)
  );

  const colors =
    availableColors && availableColors.length > 0
      ? availableColors
      : COLORS.map((color) => ({ color, count: 0 }));

  const [discountOnly, setDiscountOnly] = useState(searchParams.get("discountOnly") === "true");
  const [excludeOutliers, setExcludeOutliers] = useState(searchParams.get("excludeOutliers") === "true");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    // Filtreyi uygulayınca ilk sayfaya dön; keşfet akışının tohumu/dilimi arama sonuçlarına taşınmasın.
    for (const key of ["page", "seed", "slot", "b", "compact"]) params.delete(key);
    const formKeys = ["q", "brand", "model", "city", "color", "yearMin", "yearMax", "priceMin", "priceMax", "fuelType", "transmission", "vehicleClass", "sort", "discountOnly", "firsat"];
    formKeys.forEach((key) => params.delete(key));

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim()) {
        params.set(key, value.trim());
      }
    }

    router.push(`/?${params.toString()}`);
  }

  function toggleDiscount() {
    const next = !discountOnly;
    setDiscountOnly(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("discountOnly", "true");
    } else {
      params.delete("discountOnly");
    }
    params.delete("page");
    router.push(`/?${params.toString()}`);
  }

  function toggleOutliers() {
    const next = !excludeOutliers;
    setExcludeOutliers(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("excludeOutliers", "true");
    else params.delete("excludeOutliers");
    params.delete("page");
    router.push(`/?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-3 sm:p-5 md:p-6">
      {discountOnly && <input type="hidden" name="discountOnly" value="true" />}
      {searchParams.get("firsat") === "1" && <input type="hidden" name="firsat" value="1" />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Filtreler</p>
          <h2 className="font-display text-lg font-semibold">Aradığın aracı daralt</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleOutliers}
            aria-pressed={excludeOutliers}
            className={`chip ${excludeOutliers ? "chip-active" : ""}`}
            title="Son piyasa taramasında model ailesine göre aykırı bulunan fiyatları gizler"
          >
            Aykırı fiyatları gizle
          </button>
          <button
            type="button"
            onClick={toggleDiscount}
            aria-pressed={discountOnly}
            className={`chip ${discountOnly ? "chip-active" : ""}`}
          >
            <Icon name="trendDown" size={15} />
            Fiyatı düşenler
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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
      </div>

      <details className="filter-more" open={hasAdvanced}>
        <summary className="btn btn-ghost -ml-2 cursor-pointer select-none text-sm">
          <Icon name="plus" size={15} className="filter-more-icon" />
          Daha fazla filtre
          <span className="text-xs font-normal text-[var(--faint)]">sıralama, yıl, fiyat, yakıt, vites, renk, araç tipi</span>
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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
            <option value="deal">Piyasanın en altında</option>
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
          <FormattedNumberInput
            id="priceMin"
            name="priceMin"
            defaultValue={searchParams.get("priceMin") || ""}
            className="input"
            placeholder="500.000 ₺"
          />
        </div>

        <div>
          <label className="label" htmlFor="priceMax">
            Max fiyat
          </label>
          <FormattedNumberInput
            id="priceMax"
            name="priceMax"
            defaultValue={searchParams.get("priceMax") || ""}
            className="input"
            placeholder="2.000.000 ₺"
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
          <label className="label" htmlFor="vehicleClass">
            Araç tipi
          </label>
          <select
            id="vehicleClass"
            name="vehicleClass"
            defaultValue={searchParams.get("vehicleClass") || ""}
            className="select"
          >
            <option value="">Tümü</option>
            {VEHICLE_CLASSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
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
      </details>

      <div className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-4">
        <button type="submit" className="btn btn-primary flex-1 justify-center sm:flex-none">
          <Icon name="search" size={16} strokeWidth={1.8} />
          Ara
        </button>
        <button
          type="button"
          className="btn btn-secondary flex-1 justify-center sm:flex-none"
          onClick={() => router.push("/")}
        >
          Temizle
        </button>
      </div>
    </form>
  );
}
