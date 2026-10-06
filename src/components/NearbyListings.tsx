"use client";

import { useState } from "react";
import { CarStrip, MiniCarCard } from "@/components/CarStrip";
import { Icon } from "@/components/Icon";

interface NearbyCar {
  _id: string;
  title: string;
  year: number;
  city: string;
  district?: string;
  price: number;
  mileage?: number;
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
      (err) => {
        // Eskiden her hata "izin verilmedi" deniyordu; masaüstünde en sık görülen aslında
        // konumun bulunamaması ya da zaman aşımı.
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Konum izni verilmedi. Tarayıcı ayarlarından izin verip tekrar dene."
            : err.code === err.TIMEOUT
              ? "Konum zamanında alınamadı. Tekrar dene."
              : "Konumun belirlenemedi (bilgisayarda Wi-Fi/konum servisi kapalı olabilir). Tekrar dene."
        );
        setState("error");
      },
      { timeout: 15000, maximumAge: 10 * 60 * 1000, enableHighAccuracy: false }
    );
  }

  if (state === "idle" || state === "loading" || state === "error") {
    return (
      <section className="surface-2 flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)]">
          <Icon name="location" size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Yakınımdaki ilanlar</h2>
          <p className={`text-xs ${state === "error" ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
            {state === "error" ? error : "Konumunu paylaş, en yakın ilanları mesafeye göre sıralayalım. Konumun yalnızca bu sıralama için kullanılır."}
          </p>
        </div>
        <button onClick={locate} disabled={state === "loading"} className="btn btn-secondary shrink-0 text-sm">
          {state === "loading" ? "Konum alınıyor…" : "Konumumu kullan"}
        </button>
      </section>
    );
  }

  if (cars.length === 0) {
    return (
      <section className="surface-2 px-4 py-3">
        <h2 className="text-sm font-semibold">Yakınımdaki ilanlar</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">Yakınında eşleşen ilan bulunamadı.</p>
      </section>
    );
  }

  return (
    <CarStrip eyebrow="Mesafeye göre" title="Yakınımdaki ilanlar">
      {cars.map((car) => (
        <MiniCarCard
          key={car._id}
          car={car}
          tag={`${car.district ? `${car.district} · ` : ""}${car.approximate ? "~" : ""}${car.distanceKm.toLocaleString("tr-TR")} km`}
        />
      ))}
    </CarStrip>
  );
}
