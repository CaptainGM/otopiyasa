"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Hesap bilgileri kartında ad soyad satırı: yazılır, kaydedilir, sayfa (başlık ve menü) yenilenir. */
export function EditProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const changed = name.trim().replace(/\s+/g, " ") !== saved;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Profil güncellenemedi.");
      setSaved(data.user?.name || name.trim());
      setName(data.user?.name || name.trim());
      setSuccess(data.message || "Profilin güncellendi.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profil güncellenemedi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="label" htmlFor="profileName">
        Ad Soyad
      </label>
      <div className="flex gap-2">
        <input
          id="profileName"
          className="input flex-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoComplete="name"
          required
        />
        <button type="submit" disabled={loading || !changed} className="btn btn-primary shrink-0">
          {loading ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {success && <p className="text-sm text-emerald-300">{success}</p>}
    </form>
  );
}
