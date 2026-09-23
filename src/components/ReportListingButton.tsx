"use client";

import { useState } from "react";
import Link from "next/link";

const REASONS: { value: string; label: string }[] = [
  { value: "satildi", label: "İlan satılmış / artık mevcut değil" },
  { value: "yanlis-bilgi", label: "Bilgiler yanlış veya yanıltıcı (fiyat, km, yıl vb.)" },
  { value: "dolandiricilik", label: "Dolandırıcılık şüphesi" },
  { value: "uygunsuz", label: "Uygunsuz / alakasız içerik" },
  { value: "diger", label: "Diğer" },
];

export function ReportListingButton({ carId, loggedIn }: { carId: string; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0].value);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <Link href={`/login?next=/cars/${carId}`} className="text-xs text-slate-500 hover:text-amber-300 hover:underline">
        🚩 Bildirmek için giriş yap
      </Link>
    );
  }

  if (done) {
    return <p className="text-xs text-slate-500">{done}</p>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 transition hover:text-rose-300 hover:underline"
      >
        🚩 İlanı bildir
      </button>
    );
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId, reason, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone("Bildirimin için teşekkürler, ekip inceleyecek.");
      } else {
        setDone(data.error || "Şikayet gönderilemedi.");
      }
    } catch {
      setDone("Şikayet gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs font-semibold text-slate-300">İlanı neden bildiriyorsun?</p>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="select w-full text-xs"
      >
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
