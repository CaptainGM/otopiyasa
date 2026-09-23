"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCompareIds, clearCompare, subscribeCompare } from "@/lib/compare-store";

export function CompareTray() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(getCompareIds());
    return subscribeCompare(() => setIds(getCompareIds()));
  }, []);

  if (ids.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#12141a]/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-[#221202]">
            {ids.length}
          </span>
          <span className="text-sm text-slate-300">araç seçildi</span>
        </div>
        <div className="h-6 w-px bg-white/10" />
        <button
          type="button"
          onClick={clearCompare}
          className="text-sm text-slate-400 transition hover:text-white"
        >
          Temizle
        </button>
        {ids.length >= 2 ? (
          <Link href={`/compare?ids=${ids.join(",")}`} className="btn btn-primary py-2">
            Karşılaştır ({ids.length})
          </Link>
        ) : (
          <span className="text-xs text-slate-500">En az 2 araç seç</span>
        )}
      </div>
    </div>
  );
}
