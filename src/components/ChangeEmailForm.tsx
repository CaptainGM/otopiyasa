"use client";

import { useState } from "react";

type Stage = "idle" | "awaiting-current" | "awaiting-new";

export function ChangeEmailForm({
  currentEmail,
  initialStage,
  maskedCurrentEmail,
  maskedPendingEmail,
}: {
  currentEmail: string;
  initialStage: Stage;
  maskedCurrentEmail: string;
  maskedPendingEmail: string | null;
}) {
  const [stage, setStage] = useState<Stage>(initialStage);
  const [email, setEmail] = useState(currentEmail);
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [pendingLabel, setPendingLabel] = useState(maskedPendingEmail || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function post(url: string, body?: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "İşlem başarısız oldu.");
    return data;
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const data = await post("/api/auth/email-change/start", { newEmail });
      setPendingLabel(newEmail);
      setStage("awaiting-current");
      setCode("");
      setSuccess(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız oldu.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCurrent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const data = await post("/api/auth/email-change/verify-current", { code });
      setStage("awaiting-new");
      setCode("");
      setSuccess(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod doğrulanamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyNew(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const data = await post("/api/auth/email-change/verify-new", { code });
      setEmail(data.email);
      setStage("idle");
      setCode("");
      setNewEmail("");
      setSuccess(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod doğrulanamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function cancel() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await post("/api/auth/email-change/cancel");
      setStage("idle");
      setCode("");
      setNewEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "İptal edilemedi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Şu anki e-postan: <strong className="text-slate-300">{email}</strong>
      </p>

      {stage === "idle" && (
        <form onSubmit={start} className="space-y-4">
          <div>
            <label className="label" htmlFor="newEmail">
              Yeni e-posta
            </label>
            <input
              id="newEmail"
              type="email"
              className="input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="ornek@eposta.com"
              required
            />
          </div>
          {error && <ErrorBox message={error} />}
          {success && <SuccessBox message={success} />}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Gönderiliyor..." : "Doğrulama kodu gönder"}
          </button>
        </form>
      )}

      {stage === "awaiting-current" && (
        <form onSubmit={verifyCurrent} className="space-y-4">
          <p className="text-sm text-slate-400">
            <strong className="text-slate-300">{maskedCurrentEmail}</strong> adresine gönderdiğimiz 6
            haneli kodu gir. Bu adım, işlemi gerçekten senin başlattığını doğrular.
          </p>
          <div>
            <label className="label" htmlFor="codeCurrent">
              Doğrulama kodu
            </label>
            <input
              id="codeCurrent"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="input tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
          {error && <ErrorBox message={error} />}
          {success && <SuccessBox message={success} />}
          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Doğrulanıyor..." : "Kodu doğrula"}
            </button>
            <button type="button" className="btn" onClick={cancel} disabled={loading}>
              Vazgeç
            </button>
          </div>
        </form>
      )}

      {stage === "awaiting-new" && (
        <form onSubmit={verifyNew} className="space-y-4">
          <p className="text-sm text-slate-400">
            Bu sefer <strong className="text-slate-300">{pendingLabel}</strong> adresine bir kod gönderdik.
            Adresin gerçekten sana ait olduğunu doğrulamak için o kodu gir.
          </p>
          <div>
            <label className="label" htmlFor="codeNew">
              Doğrulama kodu
            </label>
            <input
              id="codeNew"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="input tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
          {error && <ErrorBox message={error} />}
          {success && <SuccessBox message={success} />}
          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Doğrulanıyor..." : "E-postayı güncelle"}
            </button>
            <button type="button" className="btn" onClick={cancel} disabled={loading}>
              Vazgeç
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {message}
    </p>
  );
}

function SuccessBox({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
      {message}
    </p>
  );
}
