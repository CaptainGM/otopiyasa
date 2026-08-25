"use client";

import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    setResetUrl("");

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "İşlem başarısız.");
        return;
      }

      setMessage(data.message);
      if (data.resetUrl) setResetUrl(data.resetUrl);
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Şifremi Unuttum</h2>
        <p className="text-sm text-slate-400">
          E-posta adresini gir. Sıfırlama bağlantısı veritabanına kaydedilir.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="email">
          E-posta
        </label>
        <input id="email" name="email" type="email" className="input" required />
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {resetUrl && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm">
          <p className="mb-2 text-amber-100">Geliştirme modu sıfırlama linki:</p>
          <Link href={resetUrl.replace(/^https?:\/\/[^/]+/, "")} className="break-all text-amber-300 underline">
            {resetUrl}
          </Link>
        </div>
      )}

      <button type="submit" disabled={loading} className="btn btn-primary w-full">
        {loading ? "Oluşturuluyor..." : "Sıfırlama Bağlantısı Oluştur"}
      </button>

      <p className="text-center text-sm text-slate-400">
        <Link href="/login" className="text-amber-300 hover:underline">
          Giriş sayfasına dön
        </Link>
      </p>
    </form>
  );
}
