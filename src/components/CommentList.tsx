"use client";

import { useEffect, useState } from "react";
import { Comment as CommentType } from "@/types";

interface Props {
  carId: string;
}

interface SentimentSummary {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  positivePct: number;
  negativePct: number;
}

const SENTIMENT_META: Record<
  NonNullable<CommentType["sentiment"]>,
  { emoji: string; label: string; className: string }
> = {
  positive: { emoji: "🙂", label: "Olumlu", className: "text-emerald-400" },
  neutral: { emoji: "😐", label: "Nötr", className: "text-slate-400" },
  negative: { emoji: "🙁", label: "Olumsuz", className: "text-red-400" },
};

export function CommentList({ carId }: Props) {
  const [comments, setComments] = useState<CommentType[]>([]);
  const [summary, setSummary] = useState<SentimentSummary | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/comments?carId=${encodeURIComponent(carId)}`)
      .then((r) => r.json())
      .then((data) => {
        setComments(data.comments || []);
        setSummary(data.sentimentSummary || null);
      })
      .catch(() => {
        setComments([]);
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!carId) return;
    load();
   
  }, [carId]);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail || {};
      if (!detail.carId || detail.carId !== carId) return;
      load();
    }

    window.addEventListener("comment:posted", handler as EventListener);
    return () => window.removeEventListener("comment:posted", handler as EventListener);
   
  }, [carId]);

  if (loading) return <p>Yorumlar yükleniyor…</p>;
  if (comments.length === 0) return <p className="text-slate-500">Henüz yorum yok.</p>;

  return (
    <div className="space-y-4">
      {summary && summary.total >= 2 && (
        <div className="card flex flex-wrap items-center gap-3 p-3 text-sm">
          <span className="text-slate-400">Yorum duygu dağılımı:</span>
          <span className="font-semibold text-emerald-400">%{summary.positivePct} olumlu</span>
          <span className="font-semibold text-red-400">%{summary.negativePct} olumsuz</span>
        </div>
      )}

      {comments.map((c) => {
        const meta = c.sentiment ? SENTIMENT_META[c.sentiment] : null;
        return (
          <div key={c._id} className="card p-4">
            <div className="flex items-center justify-between">
              <strong>{typeof c.user === "string" ? "Anonim" : c.user.name}</strong>
              <span className="text-sm text-slate-500">{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2">{c.text}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-yellow-500">{"★".repeat(Math.max(0, Math.min(5, c.rating)))}</span>
              {meta && (
                <span className={`text-xs font-medium ${meta.className}`}>
                  {meta.emoji} {meta.label}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
