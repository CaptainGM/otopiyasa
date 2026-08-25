"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SeedButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSeed() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/seed", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        setMessage(data.message);
        router.refresh();
      } else {
        setMessage(data.error || "Seed başarısız.");
      }
    } catch {
      setMessage("MongoDB bağlantısı kurulamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
      <div>
        <h3 className="font-semibold">Demo verileri yükle</h3>
        <p className="text-sm text-slate-500">
          MongoDB boşsa 12 örnek araç ilanı ekler.
        </p>
        {message && <p className="mt-2 text-sm text-blue-700">{message}</p>}
      </div>
      <button onClick={handleSeed} disabled={loading} className="btn btn-primary">
        {loading ? "Yükleniyor..." : "Demo Veriyi Yükle"}
      </button>
    </div>
  );
}
