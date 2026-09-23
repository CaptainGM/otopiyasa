"use client";

import { useState } from "react";


export function ShareButton({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, url: window.location.href });
        return;
      } catch {
      
      }
    }
    setOpen((v) => !v);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
 
    }
  }

  const whatsappHref =
    typeof window !== "undefined"
      ? `https://wa.me/?text=${encodeURIComponent(`${title} — ${window.location.href}`)}`
      : "#";

  return (
    <div className="relative">
      <button onClick={share} className="btn btn-secondary">
        ↗ Paylaş
      </button>
      {open && (
        <div className="absolute z-10 mt-2 w-48 space-y-1 rounded-xl border border-white/10 bg-[#0f1420] p-2 shadow-xl">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
          >
            WhatsApp&apos;ta paylaş
          </a>
          <button
            onClick={copyLink}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
          >
            {copied ? "Kopyalandı ✓" : "Bağlantıyı kopyala"}
          </button>
        </div>
      )}
    </div>
  );
}
