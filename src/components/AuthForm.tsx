"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { PasswordConfirmField } from "@/components/PasswordConfirmField";
import { checkPassword, PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
 
  const nextParam = searchParams.get("next");
  const nextUrl = nextParam && nextParam.startsWith("/") ? nextParam : "/";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
 
  const [info, setInfo] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

   
    if (mode === "register") {
      const check = checkPassword(password);
      if (!check.valid) {
        setError(`Şifre yeterince güçlü değil. Eksikler: ${check.failed.join(", ")}.`);
        return;
      }
      
      if (password !== confirmPassword) {
        setError("Şifreler birbiriyle eşleşmiyor.");
        return;
      }
    }

    setLoading(true);
    setError("");
    setInfo("");
    setNeedsVerification(false);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "İşlem başarısız.");
      
        if (data.needsVerification) setNeedsVerification(true);
        return;
      }

      
      if (data.requiresVerification) {
        setInfo(data.message || "Hesabın oluşturuldu. E-postandaki doğrulama bağlantısına tıkla.");
        return;
      }

      router.push(nextUrl);
      router.refresh();
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    if (!email) {
      setError("Önce e-posta adresini gir.");
      return;
    }
    setResent(true);
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setInfo("Doğrulama bağlantısı tekrar gönderildi. Gelen kutunu kontrol et.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">
          {mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
        </h2>
        <p className="text-sm text-slate-400">
          {mode === "login"
            ? "Hesabınla devam et; favorilerin ve ilanların seni bekliyor."
            : "Ücretsiz hesap oluştur: favori ekle, ilan ver ve fiyat alarmları kur."}
        </p>
      </div>

      {mode === "register" && (
        <div>
          <label className="label" htmlFor="name">
            Ad Soyad
          </label>
          <input id="name" name="name" className="input" required />
        </div>
      )}

      <div>
        <label className="label" htmlFor="email">
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Şifre
        </label>
        <input
          id="password"
          name="password"
          type="password"
          
          minLength={mode === "register" ? PASSWORD_MIN_LENGTH : undefined}
          className="input"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
        />
        {mode === "register" && <PasswordRequirements password={password} />}
      </div>

      {mode === "register" && (
        <PasswordConfirmField
          password={password}
          value={confirmPassword}
          onChange={setConfirmPassword}
          label="Şifre (tekrar)"
        />
      )}

      {mode === "login" && (
        <div className="text-right">
          <Link href="/forgot-password" className="text-sm text-amber-300 hover:underline">
            Şifremi unuttum
          </Link>
        </div>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}

      {needsVerification && (
        <button
          type="button"
          onClick={resendVerification}
          disabled={resent}
          className="btn btn-secondary w-full text-sm"
        >
          {resent ? "Doğrulama bağlantısı gönderildi" : "Doğrulama e-postasını tekrar gönder"}
        </button>
      )}

      {info && (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          📧 {info}
        </div>
      )}

      {!info && (
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? "Bekleyin..." : mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}
        </button>
      )}

      <p className="text-center text-sm text-slate-400">
        {mode === "login" ? (
          <>
            Hesabın yok mu?{" "}
            <Link href="/register" className="text-amber-300 hover:underline">
              Kayıt ol
            </Link>
          </>
        ) : (
          <>
            Zaten hesabın var mı?{" "}
            <Link href="/login" className="text-amber-300 hover:underline">
              Giriş yap
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
