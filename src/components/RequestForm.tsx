"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MESSAGE_MAX, REQUEST_TYPES, REQUEST_TYPE_LABELS, SUBJECT_MAX, type RequestType } from "@/lib/support-request";

/** Talep / şikayet formu. Giriş yapılmadıysa e-posta zorunludur; gizli alan botları durdurur. */
export function RequestForm() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [type, setType] = useState<RequestType>("sikayet");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [carRef, setCarRef] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setLoggedIn(Boolean(data.user)))
      .catch(() => setLoggedIn(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, subject, message, email, name, carRef, consent, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Talep gönderilemedi, lütfen tekrar dene.");
        return;
      }
      setReference(data.id ? String(data.id).slice(-8).toUpperCase() : "");
    } catch {
      setError("Bağlantı sorunu oldu, lütfen tekrar dene.");
    } finally {
      setBusy(false);
    }
  }

  if (reference !== null) {
    return (
      <div className="card space-y-3 p-6">
        <h2 className="text-xl font-semibold">Talebin alındı</h2>
        {reference && (
          <p className="text-sm text-slate-300">
            Referans kodun: <strong className="num text-amber-300">{reference}</strong>
          </p>
        )}
        <p className="text-sm text-slate-400">
          Yöneticilere bildirim gitti. Yanıt gerekiyorsa bildirdiğin e-posta adresi üzerinden dönüş yapılır.
        </p>
      </div>
    );
  }

  const inputClass = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm outline-none focus:border-amber-400/60";

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Talep türü</span>
        <select value={type} onChange={(e) => setType(e.target.value as RequestType)} className={inputClass}>
          {REQUEST_TYPES.map((value) => (
            <option key={value} value={value}>
              {REQUEST_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Konu</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={SUBJECT_MAX} required className={inputClass} />
      </label>

      <label className="block space-y-1.5">
        <span className="flex items-center justify-between text-sm font-semibold">
          Mesaj
          <span className="text-xs font-normal text-slate-500">
            {message.length}/{MESSAGE_MAX}
          </span>
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MESSAGE_MAX}
          rows={6}
          required
          className={inputClass}
        />
      </label>

      {loggedIn === false && (
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">E-posta (yanıt için, zorunlu)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} required className={inputClass} />
        </label>
      )}

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Adın (isteğe bağlı)</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputClass} />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">İlgili ilan (isteğe bağlı)</span>
        <input
          value={carRef}
          onChange={(e) => setCarRef(e.target.value)}
          placeholder="İlan bağlantısını yapıştır"
          className={inputClass}
        />
      </label>

      {/* Gizli alan: insanlar görmez, botlar doldurur. */}
      <div aria-hidden className="hidden">
        <label>
          Web sitesi
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <label className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-400">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        <span>
          Talebimin ve iletişim bilgilerimin yalnızca bu talebi incelemek ve yanıtlamak için işlenmesini kabul ediyorum.{" "}
          <a href="/gizlilik#talep" className="underline hover:text-slate-200">
            Talep ve şikayet bölümü
          </a>
        </span>
      </label>

      {error && <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

      <button type="submit" disabled={busy || loggedIn === null} className="btn btn-primary w-full justify-center disabled:opacity-50">
        {busy ? "Gönderiliyor…" : "Talebi gönder"}
      </button>
    </form>
  );
}
