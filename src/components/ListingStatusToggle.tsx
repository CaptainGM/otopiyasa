"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";


export function ListingStatusToggle({
  carId,
  status,
}: {
  carId: string;
  status: "active" | "sold" | "removed";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

 
  if (status === "removed") return null;

  async function toggle() {
    setBusy(true);
    await fetch(`/api/listings/${carId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status === "sold" ? "active" : "sold" }),
    }).catch(() => {});
    setBusy(false);
    router.refresh();
  }

  return (
    <button onClick={toggle} disabled={busy} className="btn btn-secondary text-sm">
      {busy ? "…" : status === "sold" ? "Tekrar yayına al" : "Satıldı olarak işaretle"}
    </button>
  );
}
