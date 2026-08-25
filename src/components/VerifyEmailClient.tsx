"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type State = "verifying" | "success" | "error";

export function VerifyEmailClient() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const token = params.get("token") || "";

  const [state, setState] = useState<State>("verifying");
  const [message, setMessage] = useState("");
  const [resent, setResent] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    
    if (ran.current) return;
    ran.current = true;

    if (!email || !token) {
      setState("error");
      setMessage("Doğrulama bağlantısı eksik veya bozuk.");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (r.ok) {
          setState("success");
          setMessage(data.message || "E-posta adresin doğrulandı.");
          setTimeout(() => {
            router.push("/");
            router.refresh();
          }, 1800);
        } else {
          setState("error");
          setMessage(data.error || "Doğrulama başarısız.");
        }
      })
      .catch(() => {
        setState("error");
        setMessage("Sunucuya bağlanılamadı.");
      });
  }, [email, token, router]);

  async function resend() {
    setResent(true);
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
  }

  return (
    <div className="card space-y-4 p-8 text-center">
      <h1 className="text-2xl font-black">E-posta Doğrulama</h1>

      {state === "verifying" && (
        <div className="flex flex-col items-center gap-3 py-4 text-slate-400">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-300" />
          Doğrulanıyor…
        </div>
      )}

      {state === "success" && (
        <>
          <p className="text-4xl">✅</p>
          <p className="text-emerald-300">{message}</p>
          <p className="text-sm text-slate-500">Ana sayfaya yönlendiriliyorsun…</p>
        </>
      )}

      {state === "error" && (
        <>
          <p className="text-4xl">⚠️</p>
          <p className="text-rose-300">{message}</p>
          {email && (
            <button
              type="button"
              onClick={resend}
              disabled={resent}
              className="btn btn-secondary w-full"
            >
              {resent ? "Yeni bağlantı gönderildi" : "Yeni doğrulama bağlantısı gönder"}
            </button>
          )}
          <Link href="/login" className="block text-sm text-amber-300 hover:underline">
            Giriş sayfasına dön
          </Link>
        </>
      )}
    </div>
  );
}
