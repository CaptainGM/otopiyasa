"use client";

import { useState } from "react";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);


  async function handleLogout() {
    if (busy) return;
    setBusy(true);

    try {
      document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";
    } catch {
      // ignore
    }

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        keepalive: true,
      });
    } catch {
      // ignore
    }

    window.location.href = "/";
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
