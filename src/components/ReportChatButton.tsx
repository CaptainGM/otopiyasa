"use client";

import { useState } from "react";

const REASONS: { value: string; label: string }[] = [
  { value: "kufur-hakaret", label: "Küfür / hakaret" },
  { value: "dolandiricilik", label: "Dolandırıcılık şüphesi" },
  { value: "uygunsuz", label: "Uygunsuz içerik" },
  { value: "diger", label: "Diğer" },
];

export function ReportChatButton({ offerId }: { offerId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0].value);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  if (done) return <p className="text-xs text-slate-500">{done}</p>;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 transition hover:text-rose-300 hover:underline"
      >
        🚩 Bu sohbeti bildir
      </button>
    );
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, reason, note }),
      });
      const data = await res.json().catch(() => ({}));
      setDone(res.ok ? "Bildirimin için teşekkürler, ekip inceleyecek." : data.error || "Şikayet gönderilemedi.");
    } catch {
      setDone("Şikayet gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs font-semibold text-slate-300">Bu sohbeti neden bildiriyorsun?</p>
      <select value={reason} onChange={(e) => setReason(e.target.value)} className="select w-full text-xs">
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        placeholder="İstersen kısa bir açıklama ekle (opsiyonel)"
        rows={2}
        className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-slate-200 placeholder:text-slate-600"
      />
      <p className="text-[11px] text-slate-600">
        Son mesajların bir özeti incelenmek üzere ekibe iletilir — sohbetin tamamına yalnızca taraflar erişir.
      </p>
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy} className="btn btn-secondary text-xs">
          {busy ? "Gönderiliyor…" : "Gönder"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:underline">
          Vazgeç
        </button>
      </div>
    </div>
  );
}
