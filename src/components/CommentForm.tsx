"use client";

import { useState } from "react";

interface Props {
  carId: string;
}

export function CommentForm({ carId }: Props) {
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!text.trim()) return setError("Yorum boş olamaz.");

    setLoading(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId, text, rating }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Hata");
      setText("");
      setRating(5);
      
      try {
        window.dispatchEvent(new CustomEvent("comment:posted", { detail: { carId } }));
      } catch {}
    } catch (err: any) {
      setError(err?.message || "Gönderilemedi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <div>
        <label className="label" htmlFor="comment-rating">
          Puan
        </label>
        <select
          id="comment-rating"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="select"
        >
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {"★".repeat(r)} ({r})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="comment-text">
          Yorum
        </label>
        <textarea
          id="comment-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input"
          rows={4}
          placeholder="Bu araç hakkındaki görüşünü yaz..."
        />
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary">
        {loading ? "Gönderiliyor…" : "Yorumu Gönder"}
      </button>
    </form>
  );
}
