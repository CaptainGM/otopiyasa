"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { MAX_FAVORITE_LISTS, MAX_LIST_NAME, type FavoriteListDTO } from "@/lib/favorite-lists";
import { listsRequest } from "@/lib/favorite-lists-client";

/**
 * "Gruba ekle" açılır menüsü: kullanıcının favori gruplarını (sedan, SUV...) işaretlenebilir satırlar olarak gösterir,
 * ilanı gruba ekler/çıkarır ve oradan yeni grup açtırır. Gruba eklenen ilan favorilere de eklenir.
 */
export function FavoriteListPicker({
  carId,
  lists,
  onLists,
  onFavoriteAdded,
  placement = "down",
  compact = false,
}: {
  carId: string;
  lists: FavoriteListDTO[];
  onLists: (lists: FavoriteListDTO[]) => void;
  /** İlan bir gruba eklenerek favorilere de girdiğinde (kalp durumunu güncellemek için). */
  onFavoriteAdded?: () => void;
  placement?: "down" | "up";
  compact?: boolean;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

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

  async function run(path: string, method: "POST" | "PATCH", body: unknown, added: boolean) {
    setBusy(true);
    setError("");
    const result = await listsRequest(path, method, body);
    setBusy(false);
    if (result.status === 401) {
      router.push("/login");
      return false;
    }
    if (!result.ok || !result.lists) {
      setError(result.error || "İşlem yapılamadı.");
      return false;
    }
    onLists(result.lists);
    if (added) onFavoriteAdded?.();
    return true;
  }

  async function toggle(list: FavoriteListDTO) {
    const has = list.carIds.includes(carId);
    await run(`/${list.id}`, "PATCH", has ? { remove: carId } : { add: carId }, !has);
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (await run("", "POST", { name, carId }, true)) setName("");
  }

  const memberCount = lists.filter((list) => list.carIds.includes(carId)).length;

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className={compact ? "btn btn-ghost !px-2.5 !py-1.5 text-xs" : "btn btn-secondary"}
      >
        <Icon name="tag" size={compact ? 14 : 16} className={memberCount > 0 ? "text-[var(--accent)]" : ""} />
        {memberCount > 0 ? `Gruplar (${memberCount})` : "Gruba ekle"}
      </button>

      {open && (
        <div
          role="menu"
          className={`card absolute right-0 z-40 w-72 max-w-[calc(100vw-2rem)] space-y-2 p-3 shadow-xl ${
            placement === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {lists.length === 0 ? (
            <p className="text-xs text-slate-500">Henüz grubun yok. Aşağıdan ilk grubunu aç (ör. Sedan, SUV).</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {lists.map((list) => {
                const has = list.carIds.includes(carId);
                return (
                  <li key={list.id}>
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={has}
                      disabled={busy}
                      onClick={() => toggle(list)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5 disabled:opacity-60"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          has ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]" : "border-[var(--border-strong)]"
                        }`}
                      >
                        {has && <Icon name="check" size={13} strokeWidth={2.4} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{list.name}</span>
                      <span className="text-xs text-slate-500">{list.carIds.length}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {lists.length < MAX_FAVORITE_LISTS ? (
            <form onSubmit={create} className="flex gap-2 border-t border-[var(--border)] pt-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={MAX_LIST_NAME}
                placeholder="Yeni grup adı"
                aria-label="Yeni grup adı"
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
              />
              <button type="submit" disabled={busy || !name.trim()} className="btn btn-secondary !px-3" aria-label="Grubu oluştur">
                <Icon name="plus" size={15} />
              </button>
            </form>
          ) : (
            <p className="border-t border-[var(--border)] pt-2 text-xs text-slate-500">En fazla {MAX_FAVORITE_LISTS} grup açılabilir.</p>
          )}
          {error && <p className="text-xs text-[var(--pricey)]">{error}</p>}
        </div>
      )}
    </div>
  );
}
