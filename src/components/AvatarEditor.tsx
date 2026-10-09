"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { AvatarPicker } from "@/components/AvatarPicker";
import type { AvatarDescriptor } from "@/lib/avatar";

/** Profil başlığındaki rozet: tıklayınca (ya da altındaki yazıya) küçük bir pencerede profil resmi düzenlenir. Sayfada yer kaplamaz. */
export function AvatarEditor({ name, avatar }: { name: string; avatar: AvatarDescriptor }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <button type="button" onClick={() => setOpen(true)} aria-label="Profil resmini düzenle" className="rounded-2xl transition hover:brightness-110">
          <Avatar name={name} avatar={avatar} size={64} />
        </button>
        <button type="button" onClick={() => setOpen(true)} className="text-[11px] text-slate-500 underline-offset-2 hover:text-amber-300 hover:underline">
          Profil resmini düzenle
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Profil resmini düzenle"
          onClick={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Profil resmini düzenle</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Kapat" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white">
                ✕
              </button>
            </div>
            <AvatarPicker avatar={avatar} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
