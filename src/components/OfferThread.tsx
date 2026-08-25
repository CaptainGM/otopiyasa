"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { formatRemaining, statusLabel } from "@/lib/offers";
import type { OfferView } from "@/lib/serialize-offer";
import { RISK_FLAG_LABEL } from "@/lib/chat-safety";
import { ReportChatButton } from "@/components/ReportChatButton";

function initialOf(name: string): string {
  return (name.trim()[0] || "?").toUpperCase();
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}


export function OfferThread({ initial }: { initial: OfferView }) {
  const [offer, setOffer] = useState<OfferView>(initial);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/offers/${offer.id}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setOffer(data.offer);
    }
  }, [offer.id]);


  useEffect(() => {
    const t = setInterval(reload, 20000);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [offer.events.length]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/offers/${offer.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "İşlem başarısız.");
      setText("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  }

  async function sendNewOffer() {
    const value = Number(amount.replace(/[^\d]/g, ""));
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: offer.carId, amount: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Teklif gönderilemedi.");
      setAmount("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Teklif gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  const statusTone =
    offer.status === "accepted"
      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
      : offer.status === "rejected"
        ? "border-red-400/30 bg-red-500/15 text-red-300"
        : offer.status === "expired"
          ? "border-white/10 bg-white/5 text-slate-400"
          : "border-amber-400/30 bg-amber-500/15 text-amber-300";

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <Link href={`/cars/${offer.carId}`} className="font-semibold hover:text-amber-300">
            {offer.carTitle}
          </Link>
          <p className="text-sm text-slate-400">
            {offer.role === "seller" ? "Alıcı" : "Satıcı"}: {offer.counterpartName} • İlan fiyatı{" "}
            {formatPrice(offer.carPrice)}
          </p>
        </div>
        <span className={`badge ${statusTone}`}>{statusLabel(offer.status)}</span>
      </div>

      {offer.status === "accepted" && offer.remainingMs !== null && (
        <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          ⏳ Mesajlaşma açık — kalan süre: <strong>{formatRemaining(offer.remainingMs)}</strong>.
          Süre dolduğunda bu sohbet kapanır.
        </p>
      )}

      {/* Her iki tarafın da açıkça göreceği güvenlik uyarısı — platform dışına
          taşıma ve görmeden ödeme, buradaki en yaygın dolandırıcılık kalıpları. */}
      {offer.chatOpen && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2.5 text-xs leading-relaxed text-amber-100/90">
          🛡️ <strong>Güvenliğin için:</strong> Görüşmeyi WhatsApp/Instagram gibi platformlara taşımayı
          önerme ya da kabul etme — sorun çıkarsa kanıt burada kalır. Aracı görmeden/denemeden{" "}
          <strong>asla kapora ya da ön ödeme</strong> gönderme. Şüpheli bir durumda sohbeti aşağıdan bildir.
        </div>
      )}

      {/* Telefon anlaşma sağlanınca açılır; ilan sayfasında hiç görünmüyor. */}
      {offer.sellerPhone && (
        <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          📞 Satıcının telefonu:{" "}
          <a href={`tel:${offer.sellerPhone.replace(/\s/g, "")}`} className="font-black hover:underline">
            {offer.sellerPhone}
          </a>
        </p>
      )}
      {offer.status === "expired" && (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
          Bu sohbetin 48 saatlik süresi doldu ve kapandı.
          {offer.role === "buyer" && " Dilersen yeni bir teklif gönderebilirsin."}
        </p>
      )}

      {/* Olay akışı */}
      <div className="card max-h-[420px] space-y-3 overflow-y-auto p-4">
        {offer.events.map((e) => {
          if (e.kind === "message") {
            return (
              <div key={e.id} className={`flex items-end gap-2 ${e.mine ? "flex-row-reverse" : "flex-row"}`}>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    e.mine ? "bg-amber-400 text-[#241404]" : "bg-white/15 text-slate-200"
                  }`}
                  aria-hidden
                >
                  {e.mine ? "S" : initialOf(offer.counterpartName)}
                </span>
                <div className={`flex max-w-[72%] flex-col ${e.mine ? "items-end" : "items-start"}`}>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      e.mine
                        ? "rounded-br-sm bg-amber-400 text-[#241404]"
                        : "rounded-bl-sm border border-white/10 bg-white/[0.06] text-slate-100"
                    }`}
                  >
                    {e.text}
                  </div>
                  <span className="mt-0.5 px-1 text-[10px] text-slate-600">{timeOf(e.createdAt)}</span>
                  {e.riskFlags.length > 0 && (
                    <div className="mt-0.5 max-w-full space-y-0.5 px-1">
                      {e.riskFlags.map((flag) => (
                        <p key={flag} className="text-[10px] leading-tight text-rose-300">
                          ⚠️ {RISK_FLAG_LABEL[flag]}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          }
          const label =
            e.kind === "offer"
              ? `${e.mine ? "Teklif gönderildi" : "Teklif geldi"}: ${formatPrice(e.amount || 0)}`
              : e.kind === "accepted"
                ? `Teklif kabul edildi (${formatPrice(e.amount || 0)})`
                : e.kind === "rejected"
                  ? `Teklif reddedildi (${formatPrice(e.amount || 0)})`
                  : "Süre doldu, sohbet kapandı";
          return (
            <div key={e.id} className="flex justify-center">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
                {label}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <ReportChatButton offerId={offer.id} />

      {/* Satıcı: kabul / ret */}
      {offer.canRespond && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => act({ action: "accept" })} disabled={busy} className="btn btn-primary">
            Teklifi kabul et ({formatPrice(offer.amount)})
          </button>
          <button onClick={() => act({ action: "reject" })} disabled={busy} className="btn btn-secondary">
            Reddet
          </button>
        </div>
      )}

      {/* Kabul sonrası serbest yazışma */}
      {offer.chatOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) act({ action: "message", text });
          }}
          className="flex gap-2"
        >
          <input
            className="input flex-1"
            placeholder="Mesaj yaz…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
          />
          <button type="submit" disabled={busy || !text.trim()} className="btn btn-primary">
            Gönder
          </button>
        </form>
      )}

      {/* Alıcı: reddedildikten / süre dolduktan sonra yeni teklif */}
      {offer.canOfferAgain && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendNewOffer();
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="flex-1">
            <label className="label" htmlFor="newAmount">
              Yeni teklif (₺)
            </label>
            <input
              id="newAmount"
              className="input"
              inputMode="numeric"
              placeholder="Örn. 850000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <button type="submit" disabled={busy || !amount} className="btn btn-primary">
            Yeni teklif gönder
          </button>
        </form>
      )}

      {/* Bekleyen teklifte alıcıya bilgi */}
      {offer.status === "pending" && offer.role === "buyer" && (
        <p className="text-sm text-slate-400">
          Teklifin satıcıya iletildi. Yanıt gelince buradan ve e-postandan haberdar olacaksın.
        </p>
      )}
    </div>
  );
}
