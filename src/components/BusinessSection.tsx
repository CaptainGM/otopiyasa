"use client";

import { useState } from "react";

type Status = "none" | "pending" | "approved" | "rejected";


export function BusinessSection({
  status,
  businessName,
  rejectionReason,
}: {
  status: Status;
  businessName: string;
  rejectionReason: string;
}) {
  const [name, setName] = useState(businessName);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/business/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: name, businessPhone: phone }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Başvuru gönderilemedi.");
      else setSent(true);
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold">İşletme Hesabı</h2>
        {status === "approved" && (
          <span className="badge border-emerald-400/30 bg-emerald-500/15 text-emerald-300">Onaylı</span>
        )}
        {(status === "pending" || sent) && (
          <span className="badge border-amber-400/30 bg-amber-500/15 text-amber-300">İnceleniyor</span>
        )}
      </div>

      {status === "approved" ? (
        <p className="text-sm text-slate-400">
          <strong className="text-slate-200">{businessName}</strong> olarak onaylı işletmesin.
          İlanlarında "İşletme" rozeti görünüyor.
        </p>
      ) : status === "pending" || sent ? (
        <p className="text-sm text-slate-400">
          Başvurun inceleniyor. Onaylandığında e-posta ve bildirimle haber vereceğiz.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-slate-500">
            Galeri/kurumsal satıcıysan işletme hesabı başvurusu yap. Onaylandığında
            ilanlarında firma adın ve "İşletme" rozeti çıkar.
          </p>
          {status === "rejected" && rejectionReason && (
            <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-2.5 text-xs text-rose-200">
              Önceki başvurun onaylanmadı: {rejectionReason}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="input"
              placeholder="Firma adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="input"
              placeholder="İşletme telefonu"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button type="submit" disabled={loading} className="btn btn-secondary">
            {loading ? "Gönderiliyor…" : "İşletme başvurusu gönder"}
          </button>
        </form>
      )}
    </div>
  );
}
