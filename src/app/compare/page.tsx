"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Car } from "@/types";
import { formatNumber, formatPrice, formatRelativeTr } from "@/lib/utils";
import { removeFromCompare, subscribeCompare, getCompareIds } from "@/lib/compare-store";
import { CompareAiSummary } from "@/components/CompareAiSummary";
import { CarThumbPlaceholder } from "@/components/CarThumb";
import { FallbackImage } from "@/components/FallbackImage";

function ComparePageInner() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Car[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URL'de ids yoksa localStorage seçimini kullan
  const idsFromUrl = (searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  useEffect(() => {
    const ids = idsFromUrl.length > 0 ? idsFromUrl : getCompareIds();
    if (ids.length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    fetch(`/api/compare?ids=${encodeURIComponent(ids.join(","))}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setItems(data.items || []))
      .catch(() => setError("Karşılaştırma verisi alınamadı."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // localStorage seçimi değişirse (araç çıkarılırsa) listeyi güncelle
  useEffect(() => subscribeCompare(() => {
    if (idsFromUrl.length > 0) return; // URL modundaysak dokunma
    const ids = getCompareIds();
    if (ids.length < 2) return setItems([]);
    fetch(`/api/compare?ids=${encodeURIComponent(ids.join(","))}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items || []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  if (loading) {
    return <p className="py-10 text-center text-slate-400">Karşılaştırma yükleniyor...</p>;
  }

  if (error) {
    return <p className="py-10 text-center text-red-300">{error}</p>;
  }

  if (!items || items.length < 2) {
    return (
      <div className="space-y-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">Araç Karşılaştırma</h1>
        <div className="card p-10 text-center text-slate-400">
          Karşılaştırmak için en az 2 araç seç. İlan kartlarındaki{" "}
          <span className="text-amber-300">karşılaştır</span> ikonuna dokunarak araç
          ekleyebilirsin.
          <div className="mt-4">
            <Link href="/" className="btn btn-primary">İlanlara git</Link>
          </div>
        </div>
      </div>
    );
  }

  const prices = items.map((c) => c.price);
  const mileages = items.map((c) => c.mileage);
  const minPrice = Math.min(...prices);
  const minMileage = Math.min(...mileages);
  const maxYear = Math.max(...items.map((c) => c.year));

  const rows: { label: string; render: (c: Car) => React.ReactNode; best?: (c: Car) => boolean }[] = [
    { label: "Fiyat", render: (c) => formatPrice(c.price), best: (c) => c.price === minPrice },
    {
      label: "Canlı piyasa ort.",
      render: (c) => (c.marketAvgPrice ? formatPrice(c.marketAvgPrice) : "-"),
    },
    { label: "Yıl", render: (c) => c.year, best: (c) => c.year === maxYear },
    {
      label: "Kilometre",
      render: (c) => `${formatNumber(c.mileage)} km`,
      best: (c) => c.mileage === minMileage,
    },
    { label: "Yakıt", render: (c) => c.features.fuelType },
    { label: "Vites", render: (c) => c.features.transmission },
    { label: "Kasa", render: (c) => c.features.bodyType },
    { label: "Renk", render: (c) => c.features.color },
    { label: "Motor", render: (c) => (c.features.engineSize ? `${c.features.engineSize} L` : "-") },
    { label: "Güç", render: (c) => (c.features.horsepower ? `${c.features.horsepower} HP` : "-") },
    { label: "Çekiş", render: (c) => c.features.drivetrain || "-" },
    { label: "Ort. tüketim", render: (c) => c.features.avgFuelConsumption || "-" },
    { label: "Şehir", render: (c) => c.city },
    { label: "İlan tarihi", render: (c) => c.listingDate || "-" },
    {
      label: "Son kontrol",
      // Hiç yeniden doğrulanmamış ilanda son kontrol, ilanın kaynakta ilk görüldüğü andır.
      render: (c) => {
        const checked = c.lastVerifiedAt || c.createdAt;
        return c.sourceSite === "user" || (c.status && c.status !== "active") || !checked ? "-" : formatRelativeTr(checked);
      },
    },
    {
      label: "Hasar",
      render: (c) =>
        c.damageFlag ? <span className="text-red-400">Hasar kaydı</span> : "Belirtilmemiş",
    },
  ];

  return (
    <div className="space-y-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Araç Karşılaştırma</h1>
        <span className="text-sm text-slate-500">{items.length} araç</span>
      </div>

      <CompareAiSummary items={items} />

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse sm:min-w-[640px]">
          <thead>
            <tr>
              <th className="w-12 p-1 text-left align-bottom text-[10px] text-slate-500 sm:w-32 sm:p-3 sm:text-sm">Özellik</th>
              {items.map((c) => (
                <th key={c._id} className="p-0.5 align-bottom sm:p-3">
                  <div className="card overflow-hidden">
                    {/* Kaynak fotoğraflar 16:9; aynı oran kullanılınca araç kırpılmadan tam görünür */}
                    <Link href={`/cars/${c._id}`} aria-label={`${c.title} ilanına git`} className="relative block aspect-video w-full bg-black/30">
                      <FallbackImage
                        src={c.imageUrl}
                        fallbacks={c.images}
                        alt={c.title}
                        className="h-full w-full object-cover transition hover:opacity-90"
                        fallback={<CarThumbPlaceholder />}
                      />
                    </Link>
                    <div className="space-y-0.5 p-1.5 text-left sm:space-y-1 sm:p-3">
                      <Link
                        href={`/cars/${c._id}`}
                        className="line-clamp-2 text-[11px] font-semibold leading-snug hover:text-amber-300 sm:text-sm"
                      >
                        {c.title}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeFromCompare(c._id)}
                        className="text-xs text-slate-500 transition hover:text-red-400"
                      >
                        Çıkar
                      </button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-white/5">
                <td className="p-1 text-[10px] leading-tight text-slate-500 sm:p-3 sm:text-sm">{row.label}</td>
                {items.map((c) => {
                  const isBest = row.best?.(c);
                  return (
                    <td
                      key={c._id}
                      className={`break-words p-1 text-[11px] font-medium sm:p-3 sm:text-sm ${
                        isBest ? "bg-emerald-500/10 text-emerald-300 sm:bg-transparent" : "text-slate-100"
                      }`}
                    >
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        {row.render(c)}
                        {isBest && (
                          <span className="hidden rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300 sm:inline">
                            en iyi
                          </span>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-slate-400">Yükleniyor...</p>}>
      <ComparePageInner />
    </Suspense>
  );
}
