"use client";

import { useEffect, useState } from "react";
import { MAX_NOTE_LENGTH, DEFAULT_META, type AlertMode, type FavoriteMetaDTO } from "@/lib/favorite-meta";
import { favoriteApi } from "@/lib/favorite-lists-client";

/**
 * Favori ilan için not yazma ya da fiyat bildirimi ayarlama penceresi. "note" yalnızca notu, "alert" yalnızca bildirimi gösterir.
 * Fiyat bildirimi: her düşüşte / belirlenen fiyatın altına düşünce / hiç; e-posta, mobil bildirim ya da ikisi.
 */
export function FavoriteMetaDialog({
  carId,
  mode,
  meta,
  price,
  onClose,
  onSaved,
}: {
  carId: string;
  mode: "note" | "alert";
  meta?: FavoriteMetaDTO;
  /** İlanın şu anki fiyatı (hedef fiyat için ipucu). */
  price?: number;
  onClose: () => void;
  onSaved: (meta: FavoriteMetaDTO) => void;
}) {
  const initial = meta ?? DEFAULT_META;
  const [note, setNote] = useState(initial.note);
  const [alertMode, setAlertMode] = useState<AlertMode>(initial.alertMode);
  const [below, setBelow] = useState(initial.alertBelow ? String(initial.alertBelow) : "");
  const [email, setEmail] = useState(initial.alertEmail);
  const [push, setPush] = useState(initial.alertPush);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setBusy(true);
    setError("");
    const patch: Partial<FavoriteMetaDTO> =
      mode === "note"
        ? { note }
        : {
            alertMode,
            alertBelow: alertMode === "below" ? Number(below.replace(/[^\d]/g, "")) || null : null,
            alertEmail: email,
            alertPush: push,
          };
    const result = await favoriteApi.saveMeta(carId, patch);
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error || "Kaydedilemedi.");
      return;
    }
    onSaved(result.data.meta);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "note" ? "Not" : "Fiyat bildirimi"}
        className="card w-full max-w-md space-y-4 p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {mode === "note" ? (
          <>
            <h2 className="text-lg font-bold">Not</h2>
            <p className="text-sm text-slate-500">Yalnızca sen görürsün (ör. “hafta sonu bak”, “satıcı pazarlığa açık”).</p>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, MAX_NOTE_LENGTH))}
              rows={4}
              autoFocus
              placeholder="Notunu yaz…"
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-transparent p-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <p className="text-right text-xs text-slate-500">
              {note.length}/{MAX_NOTE_LENGTH}
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold">Fiyat bildirimi</h2>
            <div className="space-y-2" role="radiogroup" aria-label="Ne zaman haber verelim?">
              {(
                [
                  ["any", "Her fiyat düşüşünde"],
                  ["below", "Fiyat belirlediğim tutarın altına düşünce"],
                  ["off", "Bildirim istemiyorum"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input type="radio" name="alert-mode" checked={alertMode === value} onChange={() => setAlertMode(value)} className="accent-[var(--accent)]" />
                  {label}
                </label>
              ))}
            </div>

            {alertMode === "below" && (
              <div className="space-y-1">
                <input
                  value={below}
                  onChange={(event) => setBelow(event.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="Hedef fiyat (₺)"
                  aria-label="Hedef fiyat"
                  className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
                {price ? <p className="text-xs text-slate-500">Şu anki fiyat: {price.toLocaleString("tr-TR")} ₺</p> : null}
              </div>
            )}

            {alertMode !== "off" && (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-semibold">Nereden haber verelim?</legend>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input type="checkbox" checked={email} onChange={(event) => setEmail(event.target.checked)} className="accent-[var(--accent)]" />
                  E-posta
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input type="checkbox" checked={push} onChange={(event) => setPush(event.target.checked)} className="accent-[var(--accent)]" />
                  Mobil uygulama bildirimi (telefon ve tarayıcı)
                </label>
              </fieldset>
            )}
          </>
        )}

        {error && <p className="text-sm text-[var(--pricey)]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
