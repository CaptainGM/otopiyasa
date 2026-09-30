"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";


interface QuestionItem {
  id: string;
  text: string;
  answer: string;
  answered: boolean;
  askerName: string;
  createdAt: string;
}

export function QuestionsSection({
  carId,
  isOwner,
  loggedIn,
}: {
  carId: string;
  isOwner: boolean;
  loggedIn: boolean;
}) {
  const [items, setItems] = useState<QuestionItem[]>([]);
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/questions?carId=${carId}`, { cache: "no-store" });
    if (res.ok) setItems((await res.json()).items || []);
  }, [carId]);

  useEffect(() => {
    load();
  }, [load]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Soru gönderilemedi.");
      setText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Soru gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function answer(id: string) {
    const value = (answers[id] || "").trim();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/questions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Cevap kaydedilemedi.");
      setAnswers((a) => ({ ...a, [id]: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cevap kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <h2 className="text-xl font-semibold">
        İlana sorulan sorular {items.length > 0 && <span className="text-slate-500">({items.length})</span>}
      </h2>

      {/* Soru sorma — sahibi soramaz */}
      {!isOwner &&
        (loggedIn ? (
          <form onSubmit={ask} className="space-y-2">
            <textarea
              className="input min-h-20"
              placeholder="Araç hakkında merak ettiğini sor (ör. tramer kaydı var mı?)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              required
            />
            <button type="submit" disabled={busy || !text.trim()} className="btn btn-primary">
              Soru sor
            </button>
          </form>
        ) : (
          <p className="text-sm text-slate-400">
            Soru sormak için{" "}
            <Link href={`/login?next=/cars/${carId}`} className="text-amber-300 hover:underline">
              giriş yap
            </Link>
            .
          </p>
        ))}

      {error && <p className="text-sm text-red-300">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Henüz soru sorulmamış.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((q) => (
            <li key={q.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-sm">
                <span className="font-semibold text-slate-200">{q.askerName}</span>{" "}
                <span className="text-slate-300">{q.text}</span>
              </p>

              {q.answered ? (
                <p className="mt-2 rounded-lg border-l-2 border-amber-400/60 bg-white/[0.03] px-3 py-2 text-sm text-amber-100">
                  <span className="font-semibold">Satıcı:</span> {q.answer}
                </p>
              ) : isOwner ? (
                <div className="mt-2 flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Yanıtla…"
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    maxLength={1000}
                  />
                  <button
                    onClick={() => answer(q.id)}
                    disabled={busy || !(answers[q.id] || "").trim()}
                    className="btn btn-primary"
                  >
                    Yanıtla
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Satıcının yanıtı bekleniyor.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
