"use client";

import { useEffect, useState } from "react";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";


function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type State = "loading" | "unsupported" | "off" | "on" | "denied" | "busy";

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !PUBLIC_KEY
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setState("busy");
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error("Sunucu aboneliği reddetti.");
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bildirim açılamadı.");
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  async function sendTestNotification() {
    setTesting(true);
    setError(null);
    setTestSuccess(null);
    try {
      // 1. Tarayıcı desteği varsa anlık yerel bildirim göster
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("🔔 OtoPiyasa Test Bildirimi", {
            body: "Anlık bildirim altyapınız başarıyla çalışıyor!",
            icon: "/icon.png",
          });
        }
      }

      // 2. Sunucuya test bildirimi kaydı ve push isteği gönder
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Test bildirimi gönderilemedi.");
      }

      setTestSuccess("✅ Test bildirimi gönderildi! Sayfa yenilendiğinde bildirim çanınızda da görebilirsiniz.");
      setTimeout(() => setTestSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test bildirimi gönderilirken hata oluştu.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center gap-3">
        <span className="stat-tile-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.5 21a2 2 0 0 0 3 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Tarayıcı bildirimleri</h2>
          <p className="text-sm text-slate-500">
            Favori araçlarının fiyatı düştüğünde anlık bildirim al.
          </p>
        </div>
      </div>

      {state === "unsupported" && (
        <p className="text-sm text-slate-500">
          Bu tarayıcı push bildirimlerini desteklemiyor.
        </p>
      )}
      {state === "denied" && (
        <p className="text-sm text-amber-300/80">
          Bildirimler tarayıcı ayarlarından engellenmiş. İzin vermek için site
          ayarlarından bildirimleri etkinleştir.
        </p>
      )}
      {state === "loading" && <p className="text-sm text-slate-500">Kontrol ediliyor…</p>}

      {state === "on" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-300">
            ● Açık
          </span>
          <button
            onClick={sendTestNotification}
            disabled={testing}
            className="btn btn-secondary text-sm border-amber-400/30 text-amber-300 hover:bg-amber-500/10"
          >
            {testing ? "Gönderiliyor…" : "🔔 Test Bildirimi Gönder"}
          </button>
          <button onClick={disable} className="btn btn-secondary text-sm">
            Kapat
          </button>
        </div>
      )}

      {/* Eğer bildirim izni verilmişse ama push subscription kapalıysa bile test butonu sun */}
      {(state === "off" || state === "busy") && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={enable}
            disabled={state === "busy"}
            className="btn btn-primary disabled:opacity-60"
          >
            {state === "busy" ? "İşleniyor…" : "Bildirimleri aç"}
          </button>
          <button
            onClick={sendTestNotification}
            disabled={testing}
            className="btn btn-secondary text-sm"
            title="Sistem içi bildirim kaydını test et"
          >
            {testing ? "Gönderiliyor…" : "🔔 Test Bildirimi"}
          </button>
        </div>
      )}

      {testSuccess && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
          {testSuccess}
        </div>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
