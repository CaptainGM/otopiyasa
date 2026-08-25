"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPrice, formatNumber } from "@/lib/utils";

type Condition = "clean" | "painted" | "damaged";

interface ComparableCar {
  _id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
}

interface PredictionResult {
  predictedPrice: number;
  method: "segment" | "brand+model" | "brand" | "global" | "average";
  sampleSize: number;
  r2: number | null;
  comparables?: ComparableCar[];
  matchedModel?: string;
  lowerBound?: number;
  upperBound?: number;
  annualDepreciationPct?: number;
  outliersRemoved?: number;
  segmentSize?: number;
  comparableRange?: { min: number; max: number };
}


const THIN_SEGMENT_LIMIT = 8;

const CONDITION_LABELS: Record<Condition, string> = {
  clean: "Hatasız / boyasız",
  painted: "Boyalı / lokal boyalı",
  damaged: "Hasar kaydı var",
};

interface LiveMarketResult {
  avg: number;
  min: number;
  max: number;
  count: number;
  source: string;
}

const METHOD_LABELS: Record<PredictionResult["method"], string> = {
  segment: "Aynı marka/model üzerinden regresyon",
  "brand+model": "Marka regresyonu + bu modelin ilanlarıyla düzeltme",
  brand: "Aynı marka üzerinden regresyon",
  global: "Tüm ilanlar üzerinden regresyon",
  average: "Yeterli veri yok, genel ortalama kullanıldı",
};

export function PricePredictorForm() {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(new Date().getFullYear() - 3);
  const [mileage, setMileage] = useState(60000);
  const [condition, setCondition] = useState<Condition>("clean");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [liveMarket, setLiveMarket] = useState<LiveMarketResult | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  
  async function fileToBase64(file: File): Promise<{ data: string; mimeType: string; preview: string }> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { data: dataUrl.split(",")[1], mimeType: "image/jpeg", preview: dataUrl };
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 6);
    if (files.length === 0) return;
    setPhotoError(null);
    setPhotoNote(null);
    setPhotoLoading(true);
    try {
      const processed = await Promise.all(files.map(fileToBase64));
      setPhotoPreviews(processed.map((p) => p.preview));
      const res = await fetch("/api/predict-price/analyze-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: processed.map((p) => ({ image: p.data, mimeType: p.mimeType })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Fotoğraf analiz edilemedi.");
      const a = json.analysis;
      
      if (a.brand) setBrand(a.brand);
      if (a.model) setModel(a.model);
      if (typeof a.year === "number") setYear(a.year);
      if (a.condition) setCondition(a.condition);
      setPhotoNote(
        [a.note, a.damageNote ? `Hasar: ${a.damageNote}` : ""].filter(Boolean).join(" ")
      );
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Fotoğraf analiz edilemedi.");
    } finally {
      setPhotoLoading(false);
      e.target.value = ""; 
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLiveMarket(null);
    setLoading(true);
    setLiveLoading(true);

     
    fetch(`/api/market-average?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setLiveMarket(json))
      .catch(() => setLiveMarket(null))
      .finally(() => setLiveLoading(false));

    try {
      const res = await fetch("/api/predict-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, model, year, mileage, condition }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Tahmin yapılamadı.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tahmin yapılamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-5">
        <div className="flex items-center gap-2">
          <span className="text-lg">📸</span>
          <div>
            <p className="font-semibold">Fotoğrafla otomatik doldur</p>
            <p className="text-xs text-slate-500">
              Araç fotoğrafı yükle — AI markayı, modeli ve hasar durumunu tanıyıp formu doldursun.{" "}
              <span className="text-amber-300/80">
                Farklı açılardan birden fazla fotoğraf daha isabetli sonuç verir (en fazla 6).
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="btn btn-secondary cursor-pointer">
            {photoLoading ? "Analiz ediliyor..." : "Fotoğraf(lar) seç"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhoto}
              disabled={photoLoading}
            />
          </label>
          {photoPreviews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photoPreviews.map((preview, i) => (
               
                <img
                  key={i}
                  src={preview}
                  alt={`Yüklenen araç ${i + 1}`}
                  className="h-16 w-24 rounded-lg object-cover ring-1 ring-white/10"
                />
              ))}
            </div>
          )}
          {photoLoading && (
            <span className="flex items-center gap-2 text-sm text-slate-400">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-300" />
              Görsel analiz ediliyor...
            </span>
          )}
        </div>

        {photoNote && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            🤖 {photoNote}
            <span className="mt-1 block text-xs text-amber-200/70">
              Alanları kontrol edip gerekiyorsa düzelt, sonra “Fiyat Tahmin Et”e bas.
            </span>
          </p>
        )}
        {photoError && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{photoError}</p>
        )}
      </div>

      <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-slate-400">Marka</label>
          <input
            className="input w-full"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Örn: Volkswagen"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Model</label>
          <input
            className="input w-full"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Örn: Golf"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Yıl</label>
          <input
            type="number"
            className="input w-full"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={1980}
            max={new Date().getFullYear() + 1}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400">Kilometre</label>
          <input
            type="number"
            className="input w-full"
            value={mileage}
            onChange={(e) => setMileage(Number(e.target.value))}
            min={0}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm text-slate-400">Araç durumu</label>
          <select
            className="select w-full"
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
          >
            {(Object.keys(CONDITION_LABELS) as Condition[]).map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[c]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Model, hasar ve boya durumunu da hesaba katar — hasarlı/boyalı araç daha
            düşük tahmin edilir.
          </p>
        </div>
        <div className="sm:col-span-2">
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Tahmin ediliyor..." : "Fiyat Tahmin Et"}
          </button>
        </div>
      </form>

      {error && (
        <div className="card border border-red-400/30 bg-red-500/10 p-4 text-red-200">
          {error}
        </div>
      )}

      {(result || liveLoading || liveMarket) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {result && (
            <div className="card space-y-2 p-5">
              <p className="text-sm uppercase tracking-widest text-amber-300">
                ML tahmini (kendi verimiz)
              </p>
              <p className="text-3xl font-black">{formatPrice(result.predictedPrice)}</p>
              {result.lowerBound && result.upperBound && (
                <p className="text-sm font-medium text-emerald-300">
                  Tahmini aralık: {formatPrice(result.lowerBound)} – {formatPrice(result.upperBound)}
                </p>
              )}
              <p className="text-sm text-slate-400">
                {METHOD_LABELS[result.method]} · {result.sampleSize} ilan verisiyle eğitildi
                {result.r2 !== null && ` · R² ≈ ${result.r2.toFixed(2)}`}
                {result.outliersRemoved
                  ? ` · ${result.outliersRemoved} aykırı ilan elendi`
                  : ""}
              </p>

              {/* Az ilanı olan modellerde tahminin neye dayandığını gizlemeyelim */}
              {typeof result.segmentSize === "number" &&
                result.segmentSize < THIN_SEGMENT_LIMIT && (
                  <p className="rounded-lg bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
                    ⚠️ Bu model için veritabanında yalnızca{" "}
                    <span className="font-semibold">{result.segmentSize} ilan</span> var.
                    {result.segmentSize > 0
                      ? " Tahmin marka geneline dayanıyor, mevcut ilanlarla düzeltildi — yine de geniş bir aralık bekle."
                      : " Tahmin marka geneline dayanıyor; farklı modeller karıştığı için aralık geniş."}
                  </p>
                )}
              {result.matchedModel && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  🔎 “{model}” yerine <span className="font-semibold">{result.matchedModel}</span> modeli
                  eşleştirildi (yazım farkı düzeltildi).
                </p>
              )}
              {typeof result.annualDepreciationPct === "number" &&
                result.annualDepreciationPct > 0 && (
                  <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">
                    📉 Bu model yıllara göre ortalama{" "}
                    <span className="font-semibold text-amber-300">
                      %{result.annualDepreciationPct}
                    </span>{" "}
                    değer kaybediyor.
                  </p>
                )}
            </div>
          )}

          <div className="card space-y-2 p-5">
            <p className="text-sm uppercase tracking-widest text-amber-300">
              Canlı Arabam ortalaması
            </p>
            {liveLoading && !liveMarket ? (
              <p className="flex items-center gap-2 py-2 text-sm text-slate-400">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-300" />
                Arabam'dan canlı fiyatlar çekiliyor...
              </p>
            ) : liveMarket ? (
              <>
                <p className="text-3xl font-black">{formatPrice(liveMarket.avg)}</p>
                <p className="text-sm text-slate-400">
                  {liveMarket.count} canlı ilan · {formatPrice(liveMarket.min)} – {formatPrice(liveMarket.max)}
                  <br />
                  Kaynak: {liveMarket.source}
                </p>
              </>
            ) : (
              <p className="py-2 text-sm text-slate-500">
                Bu model için canlı piyasa verisi bulunamadı.
              </p>
            )}
          </div>
        </div>
      )}

      {result?.comparables && result.comparables.length > 0 && (
        <div className="card p-5">
          <p className="mb-1 text-sm uppercase tracking-widest text-amber-300">
            Tahminin dayandığı benzer ilanlar
          </p>
          <p className="mb-3 text-xs text-slate-500">
            Girdiğin yıl/kilometreye en yakın gerçek ilanlar — tahminin mantığını buradan görebilirsin.
            {result.comparableRange && (
              <>
                {" "}Bu ilanların gerçek aralığı:{" "}
                <span className="font-semibold text-slate-300">
                  {formatPrice(result.comparableRange.min)} –{" "}
                  {formatPrice(result.comparableRange.max)}
                </span>
                . Aradaki farkın büyük kısmı motor/donanım ve hasar durumundan
                gelir; tahmin bu değişkenleri de hesaba katar.
              </>
            )}
          </p>
          <div className="divide-y divide-white/5">
            {result.comparables.map((car) => (
              <Link
                key={car._id}
                href={`/cars/${car._id}`}
                className="flex items-center justify-between gap-3 py-2.5 transition hover:text-amber-200"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                  {car.title}
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {car.year} · {formatNumber(car.mileage)} km
                </span>
                <span className="shrink-0 text-sm font-bold text-amber-300">
                  {formatPrice(car.price)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
