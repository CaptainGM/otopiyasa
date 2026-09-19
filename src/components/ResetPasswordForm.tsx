"use client";

import Link from "next/link";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { PasswordConfirmField } from "@/components/PasswordConfirmField";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    
    if (password !== confirmPassword) {
      setError("Şifreler birbiriyle eşleşmiyor.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password, confirmPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Şifre güncellenemedi.");
        return;
      }

      setMessage(data.message);
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  }

  if (!email || !token) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Geçersiz bağlantı</h2>
        <p className="text-sm text-slate-400">
          Sıfırlama linki eksik. Lütfen şifremi unuttum adımından tekrar dene.
        </p>
        <Link href="/forgot-password" className="btn btn-primary inline-flex">
          Şifremi unuttum
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Yeni Şifre Belirle</h2>
        <p className="text-sm text-slate-400">{email} için yeni şifre oluştur.</p>
      </div>

      <div>
        <label className="label" htmlFor="password">
          Yeni şifre
        </label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={PASSWORD_MIN_LENGTH}
          className="input"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <PasswordRequirements password={password} />
      </div>

      <PasswordConfirmField
        password={password}
        value={confirmPassword}
        onChange={setConfirmPassword}
        label="Yeni şifre (tekrar)"
      />

      {error && <p className="text-sm text-red-300">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}

      <button type="submit" disabled={loading} className="btn btn-primary w-full">
        {loading ? "Kaydediliyor..." : "Şifreyi Güncelle"}
      </button>
    </form>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={<p className="text-slate-400">Yükleniyor...</p>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
