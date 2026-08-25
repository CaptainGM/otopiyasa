"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ScrapePanel() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run(
    source: "demo" | "all" | "sahibinden" | "arabam" | "otomerkezi",
    limit?: number
  ) {
    setLoading(source + (limit ? `-${limit}` : ""));
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/scrape/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, query: "otomobil", limit }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Veri çekme başarısız.");
        return;
      }

      setMessage(
        `${data.message} Yeni: ${data.inserted}, güncellenen: ${data.updated}.`
      );
      router.refresh();
    } catch {
      setError("API'ye bağlanılamadı.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div>
        <h3 className="text-lg font-semibold">İlan kaynaklarından veri çek</h3>
        <p className="text-sm text-slate-400">
          Sahibinden ve Arabam ilanları Playwright ile çekilir. 403 alınırsa tarayıcı
          modu otomatik devreye girer. İlk kurulumda: <code>npx playwright install chromium</code>
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => run("demo")}
          disabled={!!loading}
          className="btn btn-primary"
        >
          {loading === "demo" ? "Yükleniyor..." : "Demo İlanları Yükle"}
        </button>
        <button
          onClick={() => run("all")}
          disabled={!!loading}
          className="btn btn-secondary"
        >
          {loading === "all" ? "Çekiliyor..." : "Sahibinden + Arabam Dene"}
        </button>
        <button
          onClick={() => run("sahibinden")}
          disabled={!!loading}
          className="btn btn-secondary"
        >
          Sahibinden
        </button>
        <button
          onClick={() => run("arabam")}
          disabled={!!loading}
          className="btn btn-secondary"
        >
          Arabam
        </button>
        <button
          onClick={() => run("otomerkezi", 60)}
          disabled={!!loading}
          className="btn btn-secondary"
        >
          {loading === "otomerkezi-60" ? "Çekiliyor..." : "Otomerkezi (galeri, hızlı)"}
        </button>
        <button
          onClick={() => run("arabam", 10000)}
          disabled={!!loading}
          className="btn btn-secondary"
        >
          {loading === "arabam-10000" ? "Çekiliyor... (saatler sürer)" : "Geniş Tarama (Arabam, tüm markalar, hedef 10.000)"}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Geniş tarama ~55 markanın her birinden ilan toplar ve site kısıtlamalarına takılmamak için
        yavaş ilerler; hedef 10.000 ilan olsa da genelde piyasada o an bulunan kadarını çeker.
        Birkaç saat sürebilir ve yüzlerce MB veri indirir — her ilan anında kaydedildiği için
        yarıda kesersen o ana kadar çekilenler korunur. Kotalı bağlantıda başlatmadan önce düşün.
      </p>

      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
