"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { FallbackImage } from "@/components/FallbackImage";
import { FavoriteListChoices } from "@/components/FavoriteListChoices";
import { FavoriteMetaDialog } from "@/components/FavoriteMetaDialog";
import { MAX_FAVORITE_LISTS, MAX_LIST_NAME, type FavoriteListDTO } from "@/lib/favorite-lists";
import { isDefaultMeta, type FavoriteMetaDTO } from "@/lib/favorite-meta";
import { alertSummary, favoriteApi } from "@/lib/favorite-lists-client";

export interface BoardItem {
  id: string;
  /** Sunucuda çizilmiş ilan kartı. */
  node: ReactNode;
  /** Liste kartında gösterilecek küçük kapak fotoğrafı. */
  cover?: string;
  price?: number;
  /** Artık yayında olmayan favori (satılmış/kaldırılmış): kendi "çıkar" düğmesi vardır. */
  unavailable?: boolean;
}

/**
 * Favoriler sayfasının gövdesi. Önce liste kartları ("Favori Listem" ve kendi listeleri) görünür; bir listeye tıklayınca ilanları
 * açılır. Her ilanın altında notu, fiyat bildirimi özeti ve seçenekler menüsü (not, bildirim, başka listeye taşı, favoriden
 * kaldır) bulunur. Kartlar sunucuda çizilir; burada yalnızca gruplama ve yönetim vardır.
 */
export function FavoritesBoard({
  initialLists,
  initialMeta,
  items,
}: {
  initialLists: FavoriteListDTO[];
  initialMeta: Record<string, FavoriteMetaDTO>;
  items: BoardItem[];
}) {
  const router = useRouter();
  const [lists, setLists] = useState(initialLists);
  const [meta, setMeta] = useState(initialMeta);
  const [active, setActive] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<{ carId: string; mode: "note" | "alert" } | null>(null);

  const visibleItems = useMemo(() => items.filter((item) => !removed.has(item.id)), [items, removed]);
  const byId = useMemo(() => new Map(visibleItems.map((item) => [item.id, item])), [visibleItems]);
  const activeList = active ? lists.find((list) => list.id === active) ?? null : null;

  function idsOf(list: FavoriteListDTO) {
    return list.carIds.filter((id) => byId.has(id));
  }

  async function submitName(event: React.FormEvent) {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    const result = renaming && activeList ? await favoriteApi.renameList(activeList.id, name) : await favoriteApi.createList(name);
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error || "İşlem yapılamadı.");
      return;
    }
    setLists(result.data.lists);
    if (!renaming && result.data.createdId) setActive(result.data.createdId);
    setDraft("");
    setCreating(false);
    setRenaming(false);
  }

  async function deleteList() {
    if (!activeList || activeList.isDefault) return;
    if (!window.confirm(`"${activeList.name}" listesi silinsin mi? İçindeki ilanlar "Favori Listem"e taşınır.`)) return;
    setBusy(true);
    const result = await favoriteApi.deleteList(activeList.id);
    setBusy(false);
    if (result.ok && result.data) {
      setLists(result.data.lists);
      setActive(null);
    } else setError(result.error || "Liste silinemedi.");
  }

  async function moveCar(carId: string, listId: string) {
    const result = await favoriteApi.moveToList(listId, carId);
    if (result.ok && result.data) setLists(result.data.lists);
    else setError(result.error || "İlan taşınamadı.");
  }

  async function moveToNewList(carId: string, name: string) {
    const result = await favoriteApi.createList(name, carId);
    if (result.ok && result.data) setLists(result.data.lists);
    else setError(result.error || "Liste açılamadı.");
  }

  async function removeCar(carId: string) {
    const result = await favoriteApi.remove(carId);
    if (!result.ok) {
      setError(result.error || "Favoriden çıkarılamadı.");
      return;
    }
    setRemoved((current) => new Set(current).add(carId));
    setLists((current) => current.map((list) => ({ ...list, carIds: list.carIds.filter((id) => id !== carId) })));
    router.refresh();
  }

  function onMetaSaved(carId: string, saved: FavoriteMetaDTO) {
    setMeta((current) => {
      const next = { ...current };
      if (isDefaultMeta(saved)) delete next[carId];
      else next[carId] = saved;
      return next;
    });
  }

  // ------------------------------------------------------------------ liste kartları
  if (!activeList) {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => {
            const ids = idsOf(list);
            const covers = ids.map((id) => byId.get(id)?.cover).filter((c): c is string => Boolean(c)).slice(0, 3);
            return (
              <button
                key={list.id}
                type="button"
                onClick={() => setActive(list.id)}
                className="card group space-y-3 p-4 text-left transition hover:border-[var(--border-strong)]"
              >
                <div className="grid h-28 grid-cols-3 gap-1.5 overflow-hidden rounded-lg">
                  {[0, 1, 2].map((slot) => (
                    <div key={slot} className="overflow-hidden rounded-md bg-white/5">
                      {covers[slot] ? <FallbackImage src={covers[slot]} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                  ))}
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="truncate text-lg font-bold">{list.name}</h2>
                  <span className="shrink-0 text-sm text-slate-500">{ids.length} ilan</span>
                </div>
              </button>
            );
          })}

          {lists.length - 1 < MAX_FAVORITE_LISTS &&
            (creating ? (
              <form onSubmit={submitName} className="card flex flex-col justify-center gap-3 border-dashed p-4">
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={MAX_LIST_NAME}
                  placeholder="Liste adı (ör. SUV, Sedan)"
                  aria-label="Liste adı"
                  className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={busy || !draft.trim()} className="btn btn-primary">
                    Oluştur
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
                    Vazgeç
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  setError("");
                  setCreating(true);
                }}
                className="card flex min-h-[11rem] flex-col items-center justify-center gap-2 border-dashed p-4 text-slate-400 transition hover:text-[var(--text)]"
              >
                <Icon name="plus" size={26} />
                <span className="font-semibold">Yeni liste</span>
              </button>
            ))}
        </div>
        {error && <p className="text-sm text-[var(--pricey)]">{error}</p>}
      </div>
    );
  }

  // ------------------------------------------------------------------ bir listenin ilanları
  const listItems = idsOf(activeList).map((id) => byId.get(id)!);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setActive(null);
            setRenaming(false);
          }}
        >
          ← Listelerim
        </button>
        {renaming ? (
          <form onSubmit={submitName} className="flex flex-1 flex-wrap items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={MAX_LIST_NAME}
              aria-label="Liste adı"
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button type="submit" disabled={busy || !draft.trim()} className="btn btn-primary">
              Kaydet
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setRenaming(false)}>
              Vazgeç
            </button>
          </form>
        ) : (
          <>
            <h2 className="text-2xl font-bold">{activeList.name}</h2>
            <span className="text-sm text-slate-500">{listItems.length} ilan</span>
            {!activeList.isDefault && (
              <div className="ml-auto flex gap-1">
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  onClick={() => {
                    setDraft(activeList.name);
                    setError("");
                    setRenaming(true);
                  }}
                >
                  Yeniden adlandır
                </button>
                <button type="button" className="btn btn-ghost text-xs text-[var(--pricey)]" onClick={deleteList} disabled={busy}>
                  Listeyi sil
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {error && <p className="text-sm text-[var(--pricey)]">{error}</p>}

      {listItems.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          Bu liste henüz boş. Bir ilanın altındaki <strong>Seçenekler</strong> menüsünden ilanları buraya taşıyabilirsin.
        </div>
      ) : (
        <div className="listing-grid">
          {listItems.map((item) => (
            <div key={item.id} className="flex flex-col gap-1.5">
              {item.node}
              {!item.unavailable && (
                <CardFooter
                  carId={item.id}
                  meta={meta[item.id]}
                  lists={lists}
                  onNote={() => setDialog({ carId: item.id, mode: "note" })}
                  onAlert={() => setDialog({ carId: item.id, mode: "alert" })}
                  onMove={(listId) => moveCar(item.id, listId)}
                  onMoveToNew={(name) => moveToNewList(item.id, name)}
                  onRemove={() => removeCar(item.id)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {dialog && (
        <FavoriteMetaDialog
          carId={dialog.carId}
          mode={dialog.mode}
          meta={meta[dialog.carId]}
          price={byId.get(dialog.carId)?.price}
          onClose={() => setDialog(null)}
          onSaved={(saved) => onMetaSaved(dialog.carId, saved)}
        />
      )}
    </div>
  );
}

/** Kartın altı: not, bildirim özeti ve seçenekler menüsü. */
function CardFooter({
  carId,
  meta,
  lists,
  onNote,
  onAlert,
  onMove,
  onMoveToNew,
  onRemove,
}: {
  carId: string;
  meta?: FavoriteMetaDTO;
  lists: FavoriteListDTO[];
  onNote: () => void;
  onAlert: () => void;
  onMove: (listId: string) => void;
  onMoveToNew: (name: string) => void;
  onRemove: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const currentId = lists.find((list) => list.carIds.includes(carId))?.id ?? null;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setMoving(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setMoving(false);
  };

  return (
    <div className="space-y-1.5 px-1">
      {meta?.note && (
        <button type="button" onClick={onNote} className="block w-full rounded-lg bg-[var(--accent)]/10 px-3 py-2 text-left text-sm text-[var(--accent)]" title="Notu düzenle">
          📝 {meta.note}
        </button>
      )}
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onAlert} className="min-w-0 truncate text-left text-xs text-slate-500 hover:text-[var(--text)]" title="Fiyat bildirimini düzenle">
          🔔 {alertSummary(meta)}
        </button>
        <div ref={rootRef} className="relative shrink-0">
          <button type="button" className="btn btn-ghost !px-2.5 !py-1.5 text-xs" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)}>
            Seçenekler ⋯
          </button>
          {open && (
            <div role="menu" className="card absolute bottom-full right-0 z-40 mb-2 w-72 max-w-[calc(100vw-2rem)] space-y-1 p-2 text-sm shadow-xl">
              {moving ? (
                <div className="space-y-2 p-1">
                  <p className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Hangi listeye taşıyalım?</p>
                  <FavoriteListChoices
                    lists={lists}
                    currentId={currentId}
                    onPick={(list) => {
                      onMove(list.id);
                      close();
                    }}
                    onCreate={(name) => {
                      onMoveToNew(name);
                      close();
                    }}
                  />
                </div>
              ) : (
                <>
                  <MenuRow icon="📝" label={meta?.note ? "Notu düzenle" : "Not ekle"} onClick={() => { close(); onNote(); }} />
                  <MenuRow icon="🔔" label="Fiyat bildirimi" hint={alertSummary(meta)} onClick={() => { close(); onAlert(); }} />
                  <MenuRow icon="↪" label="Başka listeye taşı" onClick={() => setMoving(true)} />
                  <MenuRow icon="✕" label="Favorilerden kaldır" danger onClick={() => { close(); onRemove(); }} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuRow({ icon, label, hint, danger, onClick }: { icon: string; label: string; hint?: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-white/5 ${danger ? "text-[var(--pricey)]" : ""}`}
    >
      <span aria-hidden className="w-4 text-center">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block truncate text-xs text-slate-500">{hint}</span>}
      </span>
    </button>
  );
}
