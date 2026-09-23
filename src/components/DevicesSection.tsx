"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface DeviceSession {
  id: string;
  deviceLabel: string;
  lastSeenAt: string;
  createdAt: string;
  current: boolean;
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

export function DevicesSection() {
  const router = useRouter();
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => setError("Cihazlar yüklenemedi."));
  }, []);

  async function revoke(id: string, isCurrent: boolean) {
    if (isCurrent && !confirm("Bu, şu an kullandığın cihaz. Çıkış yapmak istediğine emin misin?")) {
      return;
    }
    setRevokingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Oturum kapatılamadı.");
      const data = await res.json();
      if (data.wasCurrent) {
        router.push("/login");
        router.refresh();
        return;
      }
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
    } catch {
      setError("Oturum kapatılamadı, tekrar dene.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-lg font-semibold">Cihazlarım</h2>
      <p className="mb-5 text-sm text-slate-500">
        Hesabına giriş yapılmış cihazlar. Tanımadığın bir cihaz görürsen çıkış yaptırabilirsin.
      </p>

      {sessions === null && !error && (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
      {sessions && sessions.length === 0 && (
        <p className="text-sm text-slate-500">Aktif cihaz bulunamadı.</p>
      )}

      {sessions && sessions.length > 0 && (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{s.deviceLabel}</span>
                  {s.current && (
                    <span className="badge badge-accent shrink-0 text-xs">Bu cihaz</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Son görülme: {formatRelative(s.lastSeenAt)}
                </p>
              </div>
              <button
                onClick={() => revoke(s.id, s.current)}
                disabled={revokingId === s.id}
                className="btn btn-secondary shrink-0 text-xs disabled:opacity-60"
              >
                {revokingId === s.id ? "…" : "Çıkış yap"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
