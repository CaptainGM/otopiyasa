"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";


export function OfferBox({
  carId,
  listingPrice,
  minOffer,
  isOwner,
  loggedIn,
  offerCount,
}: {
  carId: string;
  listingPrice: number;

  minOffer: number;
  isOwner: boolean;
  loggedIn: boolean;
  offerCount: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (isOwner) {
    return (
      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
        <p className="text-sm font-semibold text-amber-200">
          {offerCount > 0
            ? `Bu ilana ${offerCount} teklif geldi.`
            : "Bu ilana henüz teklif gelmedi."}
        </p>
        {minOffer > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            Alt sınırın: {formatPrice(minOffer)} — altındaki teklifler sana ulaşmaz.
          </p>
        )}
        <Link href="/offers" className="btn btn-secondary mt-2 inline-flex text-sm">
          Teklifleri yönet
        </Link>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-sm text-slate-300">Bu araca teklif vermek için giriş yap.</p>
        <Link href={`/login?next=/cars/${carId}`} className="btn btn-secondary mt-2 inline-flex text-sm">
          Giriş yap
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount.replace(/[^\d]/g, ""));
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId, amount: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Teklif gönderilemedi.");
      router.push(`/offers/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Teklif gönderilemedi.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
      <p className="mb-2 text-sm font-semibold text-amber-200">Teklif ver</p>
      <p className="mb-3 text-xs text-slate-400">
        İlan fiyatı {formatPrice(listingPrice)}.
        {minOffer > 0 && (
          <>
            {" "}
            Satıcı <strong className="text-amber-200">{formatPrice(minOffer)}</strong> ve üzeri
            teklifleri değerlendiriyor.
          </>
        )}{" "}
        Teklifin satıcıya bildirim ve e-posta olarak gider; kabul edilirse 48 saat
        mesajlaşabilirsiniz.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <label className="label" htmlFor="offerAmount">
            Teklifin (₺)
          </label>
          <input
            id="offerAmount"
            className="input"
            inputMode="numeric"
            placeholder={String(Math.max(minOffer, Math.round(listingPrice * 0.9)))}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={busy || !amount} className="btn btn-primary">
          {busy ? "Gönderiliyor…" : "Teklif gönder"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </form>
  );
}
