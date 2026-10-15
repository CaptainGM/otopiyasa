"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { PasswordConfirmField } from "@/components/PasswordConfirmField";
import { checkPassword, PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

/** Google dönüşünde /login?error=... ile gelen hata kodları (bkz. api/auth/google/callback). */
const OAUTH_ERRORS: Record<string, string> = {
  google: "Google ile giriş tamamlanamadı. Tekrar dene.",
  google_state: "Google ile giriş oturumu zaman aşımına uğradı. Tekrar dene.",
  google_cancel: "Google ile girişi iptal ettin.",
  google_conflict: "Bu e-posta adresi başka bir Google hesabına bağlı.",
  google_disabled: "Google ile giriş şu an kullanılamıyor.",
};

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function AuthForm({
  mode,
  googleEnabled = false,
}: {
  mode: "login" | "register";
  /** Sunucu Google girişini yapılandırılmış görürse true (bkz. lib/google-auth.ts). */
  googleEnabled?: boolean;
}) {
  const searchParams = useSearchParams();

  const nextParam = searchParams.get("next");
  const nextUrl = nextParam && nextParam.startsWith("/") ? nextParam : "/";
  const oauthError = OAUTH_ERRORS[searchParams.get("error") ?? ""] ?? "";
  const googleStartUrl = `/api/auth/google/start?next=${encodeURIComponent(nextUrl)}`;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
 
  const [info, setInfo] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  /** Sunucunun bildirdiği kalan "tekrar gönder" hakkı (hesap başına en fazla 3); henüz bilinmiyorsa null. */
  const [resendsLeft, setResendsLeft] = useState<number | null>(null);

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
        // Posta gelmediyse ya da gönderilemediyse kullanıcı çıkmaz sokakta kalmasın: kayıttan hemen sonra "tekrar gönder" görünür.
        setResendsLeft(typeof data.resendsLeft === "number" ? data.resendsLeft : null);
        setNeedsVerification(true);
        return;
      }

      window.location.href = nextUrl;
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
    setResending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (typeof data.resendsLeft === "number") setResendsLeft(data.resendsLeft);
      if (!response.ok) {
        setInfo("");
        setError(data.error || "Doğrulama e-postası gönderilemedi.");
      } else {
        setInfo("Doğrulama bağlantısı tekrar gönderildi. Gelen kutunu ve spam klasörünü kontrol et.");
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setResending(false);
    }
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

      {googleEnabled && (
        <>
          <a href={googleStartUrl} className="btn btn-secondary w-full gap-2">
            <GoogleMark />
            {mode === "login" ? "Google ile giriş yap" : "Google ile kayıt ol"}
          </a>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-white/10" />
            veya
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </>
      )}

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

      {(error || oauthError) && <p className="text-sm text-red-300">{error || oauthError}</p>}

      {needsVerification && (
        <button
          type="button"
          onClick={resendVerification}
          disabled={resending || resendsLeft === 0}
          className="btn btn-secondary w-full text-sm"
        >
          {resending
            ? "Gönderiliyor..."
            : resendsLeft === 0
              ? "Tekrar gönderme hakkın doldu"
              : `Doğrulama e-postasını tekrar gönder${resendsLeft !== null ? ` (${resendsLeft} hak kaldı)` : ""}`}
        </button>
      )}

      {info && (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {info}
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
