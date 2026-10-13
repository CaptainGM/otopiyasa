"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "op_app_banner_kapali";

/**
 * Üstte Android uygulaması şeridi. İndirme bağlantısı /indir: GitHub'daki en yeni yayının evrensel APK'sına gider, yani web ve
 * GitHub aynı dosyayı verir. Uygulama içi güncelleme aynı sürümün kendi mimari paketini indirir (aynı sürüm, daha küçük dosya).
 * Sürüm numarası /api/app-version'dan alınır; kapatılınca yalnızca bu oturum için gizlenir.
 */
export function AppDownloadBanner() {
  const [visible, setVisible] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // Gizli sekme vb.: şerit gösterilir.
    }
    setVisible(true);
    fetch("/api/app-version")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.version) setVersion(String(data.version));
      })
      .catch(() => {});
  }, []);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Android uygulaması"
      className="border-b border-amber-400/30 bg-amber-400/10 text-sm text-amber-100"
    >
      <div className="container flex items-center gap-3 py-2">
        <p className="min-w-0 flex-1 truncate sm:whitespace-normal">
          Android uygulaması{version ? ` v${version}` : ""} yayında. En yeni sürümü yükle; uygulama içi güncellemeler otomatik gelir.
        </p>
        <a
          href="/indir"
          className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300"
        >
          İndir
        </a>
        <button
          type="button"
          aria-label="Şeridi kapat"
          className="shrink-0 px-1.5 text-lg leading-none text-amber-100/70 hover:text-amber-100"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // Depolama yoksa yalnızca bu görünüm kapanır.
            }
            setVisible(false);
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
