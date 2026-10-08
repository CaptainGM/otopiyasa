"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { FavoriteListPicker } from "@/components/FavoriteListPicker";
import { MAX_FAVORITE_LISTS, MAX_LIST_NAME, type FavoriteListDTO } from "@/lib/favorite-lists";
import { listsRequest } from "@/lib/favorite-lists-client";

interface BoardItem {
  id: string;
  /** Sunucuda çizilmiş ilan kartı. */
  node: ReactNode;
}

/**
 * Favoriler sayfasının gövdesi: "Tümü" ve kullanıcının kendi grupları (Sedan, SUV...) sekmeler halinde.
 * Kartlar sunucuda çizilir; burada yalnızca hangi grupta hangi kartın görüneceği ve grup yönetimi vardır.
 */
export function FavoritesBoard({
  initialLists,
  items,
  unavailable,
}: {
  initialLists: FavoriteListDTO[];
  items: BoardItem[];
  /** Artık yayında olmayan favoriler bölümü; yalnızca "Tümü" sekmesinde görünür. */
  unavailable: ReactNode;
}) {
  const [lists, setLists] = useState(initialLists);
  const [active, setActive] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const available = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const activeList = lists.find((list) => list.id === active) || null;
  // Silinmiş grup sekmesi açık kaldıysa "Tümü"ne düş.
  const view = activeList ? activeList.id : "all";

  const visible = useMemo(() => {
    if (!activeList) return items;
    const members = new Set(activeList.carIds);
    return items.filter((item) => members.has(item.id));
  }, [items, activeList]);

  function countOf(list: FavoriteListDTO) {
    return list.carIds.filter((id) => available.has(id)).length;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    const result =
      renaming && activeList
        ? await listsRequest(`/${activeList.id}`, "PATCH", { name })
        : await listsRequest("", "POST", { name });
    setBusy(false);
    if (!result.ok || !result.lists) {
      setError(result.error || "İşlem yapılamadı.");
      return;
    }
    const previousIds = new Set(lists.map((list) => list.id));
    setLists(result.lists);
    if (!renaming) {
      // Yeni açılan grubun sekmesine geç.
      const created = result.lists.find((list) => !previousIds.has(list.id));
      if (created) setActive(created.id);
    }
    setDraft("");
    setCreating(false);
    setRenaming(false);
  }

  async function removeList() {
    if (!activeList) return;
    if (!window.confirm(`"${activeList.name}" grubu silinsin mi? İçindeki ilanlar favorilerde kalır.`)) return;
    setBusy(true);
    const result = await listsRequest(`/${activeList.id}`, "DELETE");
    setBusy(false);
    if (result.ok && result.lists) {
      setLists(result.lists);
      setActive("all");
    } else {
      setError(result.error || "Grup silinemedi.");
    }
  }

  async function removeFromList(carId: string) {
    if (!activeList) return;
    const result = await listsRequest(`/${activeList.id}`, "PATCH", { remove: carId });
    if (result.ok && result.lists) setLists(result.lists);
  }

  function startCreate() {
    setRenaming(false);
    setDraft("");
    setError("");
    setCreating(true);
  }

  function startRename() {
    if (!activeList) return;
    setCreating(false);
    setDraft(activeList.name);
    setError("");
    setRenaming(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Favori grupları">
        <button type="button" role="tab" aria-selected={view === "all"} aria-current={view === "all"} className="chip" onClick={() => setActive("all")}>
          Tümü ({items.length})
        </button>
        {lists.map((list) => (
          <button
            key={list.id}
            type="button"
            role="tab"
            aria-selected={view === list.id}
            aria-current={view === list.id}
            className="chip"
            onClick={() => {
              setActive(list.id);
              setRenaming(false);
            }}
          >
            {list.name} ({countOf(list)})
          </button>
        ))}
        {lists.length < MAX_FAVORITE_LISTS && (
          <button type="button" className="chip border-dashed" onClick={startCreate}>
            <Icon name="plus" size={14} />
            Yeni grup
          </button>
        )}
      </div>

      {(creating || renaming) && (
        <form onSubmit={submit} className="card flex flex-wrap items-center gap-2 p-3">
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MAX_LIST_NAME}
            placeholder="Grup adı (ör. Sedan, SUV, Aile arabası)"
            aria-label="Grup adı"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button type="submit" disabled={busy || !draft.trim()} className="btn btn-primary">
            {renaming ? "Kaydet" : "Oluştur"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setCreating(false);
              setRenaming(false);
            }}
          >
            Vazgeç
          </button>
        </form>
      )}

      {error && <p className="text-sm text-[var(--pricey)]">{error}</p>}

      {activeList && !renaming && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">
            {countOf(activeList)} ilan · &quot;{activeList.name}&quot; grubu
          </span>
          <button type="button" className="btn btn-ghost text-xs" onClick={startRename} disabled={busy}>
            Yeniden adlandır
          </button>
          <button type="button" className="btn btn-ghost text-xs text-[var(--pricey)]" onClick={removeList} disabled={busy}>
            Grubu sil
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="card p-8 text-center">
          {activeList ? (
            <p className="text-slate-500">
              Bu grup henüz boş. &quot;Tümü&quot; sekmesinde bir ilanın altındaki <strong>Gruplar</strong> düğmesiyle buraya ilan ekleyebilirsin.
            </p>
          ) : (
            <p className="text-slate-500">Henüz yayında favori ilanın yok.</p>
          )}
        </div>
      ) : (
        <div className="listing-grid">
          {visible.map((item) => (
            <div key={item.id} className="flex flex-col gap-1.5">
              {item.node}
              <div className="flex items-center justify-between gap-2 px-1">
                <FavoriteListPicker
                  carId={item.id}
                  lists={lists}
                  onLists={setLists}
                  placement="up"
                  compact
                />
                {activeList && (
                  <button type="button" className="btn btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => removeFromList(item.id)}>
                    Gruptan çıkar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!activeList && unavailable}
    </div>
  );
}
