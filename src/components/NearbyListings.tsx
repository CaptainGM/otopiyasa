"use client";

import { useState } from "react";
import Link from "next/link";
import { CarThumb } from "@/components/CarThumb";
import { DragScroller } from "@/components/DragScroller";
import { formatPrice } from "@/lib/utils";

interface NearbyCar {
  _id: string;
  title: string;
  year: number;
  city: string;
  price: number;
  imageUrl: string;
  images?: string[];
  distanceKm: number;
  approximate: boolean;
}

type State = "idle" | "loading" | "error" | "done";

export function NearbyListings() {
  const [state, setState] = useState<State>("idle");
  const [cars, setCars] = useState<NearbyCar[]>([]);
  const [error, setError] = useState("");

  function locate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Tarayıcın konum özelliğini desteklemiyor.");
      setState("error");
      return;
    }

    setState("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/nearby?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "İlanlar alınamadı.");
          setCars(data.items || []);
          setState("done");
        } catch (err) {
          setError(err instanceof Error ? err.message : "İlanlar alınamadı.");
          setState("error");
        }
      },
      () => {
        setError("Konum izni verilmedi. Tarayıcı ayarlarından izin verip tekrar dene.");
        setState("error");
      },
      { timeout: 10000 }
    );
  }

  if (state === "idle" || state === "loading" || state === "error") {
    return (
      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="text-lg font-bold">Yakınımdaki ilanlar</h2>
          <p className="text-sm text-slate-400">
            {state === "error" ? error : "Konumunu paylaş, en yakın ilanları listeleyelim."}
          </p>
        </div>
        <button onClick={locate} disabled={state === "loading"} className="btn btn-primary shrink-0">
          {state === "loading" ? "Konum alınıyor…" : "📍 Konumumu kullan"}
        </button>
      </section>
    );
  }

  if (cars.length === 0) {
    return (
      <section className="card p-5">
        <h2 className="text-lg font-bold">Yakınımdaki ilanlar</h2>
        <p className="mt-1 text-sm text-slate-400">Yakınında eşleşen ilan bulunamadı.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold tracking-tight">Yakınımdaki ilanlar</h2>
      <DragScroller className="flex gap-4 overflow-x-auto pb-2">
        {cars.map((car) => (
          <Link
            key={car._id}
            href={`/cars/${car._id}`}
            className="card group w-60 shrink-0 overflow-hidden transition hover:-translate-y-1"
          >
            <div className="relative h-32 w-full bg-[var(--bg-soft)]">
              <CarThumb
                src={car.imageUrl}
                fallbacks={car.images}
                alt={car.title}
                className="object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-slate-200">
                📍 {car.approximate ? "~" : ""}
                {car.distanceKm} km
              </span>
            </div>
            <div className="space-y-1 p-3">
              <p className="line-clamp-1 text-sm font-semibold">{car.title}</p>
              <p className="text-xs text-slate-500">
                {car.year} • {car.city}
              </p>
              <p className="text-lg font-black text-amber-300">{formatPrice(car.price)}</p>
            </div>
          </Link>
        ))}
      </DragScroller>
    </section>
  );
}
