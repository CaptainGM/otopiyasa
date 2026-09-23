"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminDeleteCarButton({ carId, title }: { carId: string; title: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`"${title}" ilanını silmek istediğine emin misin?`)) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/cars/${carId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        window.alert(data.error || "Silme başarısız.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="rounded-lg border border-red-400/25 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
    >
      {loading ? "..." : "Sil"}
    </button>
  );
}
