"use client";

import { useState } from "react";
import { QuestionsSection } from "@/components/QuestionsSection";


export function ListingQuestions({
  carId,
  initialCount,
  unanswered,
}: {
  carId: string;
  initialCount: number;
  unanswered: number;
}) {
  const [open, setOpen] = useState(unanswered > 0);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-sm font-semibold text-slate-300 hover:text-amber-300"
      >
        <span>{open ? "▾" : "▸"}</span>
        Sorular <span className="text-slate-500">({initialCount})</span>
        {unanswered > 0 && (
          <span className="badge border-amber-400/30 bg-amber-500/15 text-amber-300">
            {unanswered} yanıt bekliyor
          </span>
        )}
      </button>

      {open && <QuestionsSection carId={carId} isOwner loggedIn />}
    </div>
  );
}
