"use client";

import { useState } from "react";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);


  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
   
    }
    window.location.assign("/");
  }

  return (
    <button
      onClick={handleLogout}
      disabled={busy}
      className="btn btn-secondary px-3 py-2 text-sm"
    >
      {busy ? "Çıkılıyor..." : "Çıkış"}
    </button>
  );
}
