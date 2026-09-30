"use client";

import { useState } from "react";

interface Props {
  onCreated?: () => void;
}

export function SubscriptionForm({ onCreated }: Props) {
  const [email, setEmail] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [targetAvgPrice, setTargetAvgPrice] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (targetAvgPrice !== "" && !brand.trim()) {
      setError("Ortalama fiyat alarmı için marka girmelisin.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = { email, brand: brand || null, model: model || null };
      if (maxPrice !== "") body.maxPrice = Number(maxPrice);
      if (targetAvgPrice !== "") body.targetAvgPrice = Number(targetAvgPrice);
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Hata");
      setEmail("");
      setBrand("");
      setModel("");
      setMaxPrice("");
      setTargetAvgPrice("");
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div>
        <label className="label">E-posta</label>
        <input className="input w-full" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="label">Marka (opsiyonel)</label>
        <input className="input w-full" value={brand} onChange={(e) => setBrand(e.target.value)} />
      </div>
      <div>
        <label className="label">Model (opsiyonel)</label>
        <input className="input w-full" value={model} onChange={(e) => setModel(e.target.value)} />
      </div>
      <div>
        <label className="label">Maksimum fiyat — yeni ilan bildirimi (TL, opsiyonel)</label>
        <input
          type="number"
          className="input w-full"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value === "" ? "" : Number(e.target.value))}
        />
      </div>
      <div className="border-t border-white/10 pt-3">
        <label className="label">Piyasa ortalaması bu tutarın altına düşünce haber ver (TL, opsiyonel)</label>
        <input
          type="number"
          className="input w-full"
          value={targetAvgPrice}
          onChange={(e) => setTargetAvgPrice(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="Örn. 900000"
        />
        <p className="mt-1 text-xs text-slate-500">
          Markanın (model verirsen o modelin) güncel piyasa ortalaması bu tutarın altına inince
          e-posta gönderilir — en az 3 karşılaştırılabilir ilan gerekir, 3 günde bir tekrar edebilir.
        </p>
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Oluşturuluyor…" : "Abone Ol"}
      </button>
    </form>
  );
}
