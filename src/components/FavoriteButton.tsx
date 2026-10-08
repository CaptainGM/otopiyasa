"use client";

import { Icon } from "@/components/Icon";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FavoriteListChoices } from "@/components/FavoriteListChoices";
import { FavoriteMetaDialog } from "@/components/FavoriteMetaDialog";
import type { FavoriteListDTO } from "@/lib/favorite-lists";
import type { FavoriteMetaDTO } from "@/lib/favorite-meta";
import { alertSummary, favoriteApi } from "@/lib/favorite-lists-client";

/**
 * İlan sayfasındaki favori düğmesi. Favoride değilken tıklayınca "hangi listeye ekleyelim?" menüsü açılır; favorideyken menü
 * ilanın listesini değiştirmeyi, fiyat bildirimini, notu ve favoriden çıkarmayı sunar.
 */
export function FavoriteButton({ carId, price }: { carId: string; price?: number }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [lists, setLists] = useState<FavoriteListDTO[]>([]);
  const [meta, setMeta] = useState<FavoriteMetaDTO | undefined>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<"note" | "alert" | null>(null);

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me").then((r) => r.json()).catch(() => ({}));
      if (me?.user) {
        const result = await favoriteApi.state();
        if (result.ok && result.data) {
          setIsFavorite(result.data.ids.includes(carId));
          setLists(result.data.lists);
          setMeta(result.data.meta[carId]);
        }
      }
      setChecked(true);
    }
    load();
  }, [carId]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentList = lists.find((list) => list.carIds.includes(carId));

  /** Ortak sonuç işleme: 401 → girişe yönlendir, hata → mesaj. */
  function failed(result: { ok: boolean; status: number; error?: string }): boolean {
    if (result.ok) return false;
    if (result.status === 401) router.push("/login");
    else setError(result.error || "İşlem yapılamadı.");
    return true;
  }

  async function pick(list: FavoriteListDTO) {
    setBusy(true);
    setError("");
    const result = await favoriteApi.moveToList(list.id, carId);
    setBusy(false);
    if (failed(result) || !result.data) return;
    setLists(result.data.lists);
    setIsFavorite(true);
    setOpen(false);
    router.refresh();
  }

  async function create(name: string) {
    setBusy(true);
    setError("");
    const result = await favoriteApi.createList(name, carId);
    setBusy(false);
    if (failed(result) || !result.data) return;
    setLists(result.data.lists);
    setIsFavorite(true);
    setOpen(false);
    router.refresh();
  }

  async function removeFavorite() {
    setBusy(true);
    setError("");
    const result = await favoriteApi.remove(carId);
    setBusy(false);
    if (failed(result)) return;
    setLists((current) => current.map((list) => ({ ...list, carIds: list.carIds.filter((id) => id !== carId) })));
    setIsFavorite(false);
    setMeta(undefined);
    setOpen(false);
    router.refresh();
  }

  if (!checked) return null;

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className="btn btn-secondary"
      >
        <Icon name="heart" size={16} className={isFavorite ? "fill-[var(--pricey)] text-[var(--pricey)]" : ""} />
        {isFavorite ? `Favorilerde${currentList ? ` · ${currentList.name}` : ""}` : "Favorilere ekle"}
      </button>

      {open && (
        <div role="menu" className="card absolute left-0 z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-3 p-3 shadow-xl">
          <p className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            {isFavorite ? "Hangi listede dursun?" : "Hangi listeye ekleyelim?"}
          </p>
          <FavoriteListChoices lists={lists} currentId={isFavorite ? currentList?.id : null} busy={busy} onPick={pick} onCreate={create} />

          {isFavorite && (
            <div className="space-y-1 border-t border-[var(--border)] pt-2 text-sm">
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/5"
                onClick={() => {
                  setDialog("alert");
                  setOpen(false);
                }}
              >
                <span aria-hidden>🔔</span>
                <span>
                  <span className="block font-medium">Fiyat bildirimi</span>
                  <span className="block text-xs text-slate-500">{alertSummary(meta)}</span>
                </span>
              </button>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/5"
                onClick={() => {
                  setDialog("note");
                  setOpen(false);
                }}
              >
                <span aria-hidden>📝</span>
                <span>
                  <span className="block font-medium">{meta?.note ? "Notu düzenle" : "Not ekle"}</span>
                  {meta?.note && <span className="block max-w-[14rem] truncate text-xs text-slate-500">{meta.note}</span>}
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-medium text-[var(--pricey)] hover:bg-white/5 disabled:opacity-60"
                onClick={removeFavorite}
              >
                <span aria-hidden>✕</span>
                Favorilerden kaldır
              </button>
            </div>
          )}
          {error && <p className="text-xs text-[var(--pricey)]">{error}</p>}
        </div>
      )}

      {dialog && (
        <FavoriteMetaDialog
          carId={carId}
          mode={dialog}
          meta={meta}
          price={price}
          onClose={() => setDialog(null)}
          onSaved={(saved) => setMeta(saved.note === "" && saved.alertMode === "any" && saved.alertEmail && saved.alertPush ? undefined : saved)}
        />
      )}
    </div>
  );
}
