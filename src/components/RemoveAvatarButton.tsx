"use client";

import { useState } from "react";

/** Yönetici: kullanıcının yüklediği profil fotoğrafını kaldırır (otomatik denetim kaçırmış olabilir). */
export function RemoveAvatarButton({ userId }: { userId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function remove() {
    if (!window.confirm("Bu kullanıcının profil fotoğrafı kaldırılsın mı?")) return;
    setState("busy");
    try {
      const response = await fetch(`/api/admin/users/${userId}/avatar`, { method: "DELETE" });
      setState(response.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") return <span className="text-xs text-emerald-300">Kaldırıldı</span>;
  return (
    <button type="button" onClick={remove} disabled={state === "busy"} className="rounded-md border border-rose-400/30 px-2 py-0.5 text-xs text-rose-300 hover:bg-rose-500/10">
      {state === "busy" ? "..." : state === "error" ? "Hata, tekrar dene" : "Fotoğrafı kaldır"}
    </button>
  );
}
