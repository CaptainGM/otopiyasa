"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { MAX_FAVORITE_LISTS, MAX_LIST_NAME, type FavoriteListDTO } from "@/lib/favorite-lists";

/**
 * Liste seçici: "Favori Listem" ve kendi listeleri tek dokunuşla seçilebilir satırlar olarak gösterir, altında yeni liste açma
 * alanı vardır. İlan sayfasındaki "listeye ekle" menüsünde ve kartlardaki "başka listeye taşı"da ortak kullanılır.
 */
export function FavoriteListChoices({
  lists,
  currentId,
  busy,
  onPick,
  onCreate,
}: {
  lists: FavoriteListDTO[];
  /** İlanın şu an bulunduğu liste (işaretli görünür); ilan henüz favori değilse boş. */
  currentId?: string | null;
  busy?: boolean;
  onPick: (list: FavoriteListDTO) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const customCount = lists.filter((list) => !list.isDefault).length;

  return (
    <div className="space-y-2">
      <ul className="max-h-56 space-y-1 overflow-y-auto">
        {lists.map((list) => {
          const selected = list.id === currentId;
          return (
            <li key={list.id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={busy}
                onClick={() => onPick(list)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5 disabled:opacity-60"
              >
                <span
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
                    selected ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]" : "border-[var(--border-strong)]"
                  }`}
                >
                  {selected && <Icon name="check" size={12} strokeWidth={2.6} />}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{list.name}</span>
                <span className="text-xs text-slate-500">{list.carIds.length}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {customCount < MAX_FAVORITE_LISTS ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            onCreate(name);
            setName("");
          }}
          className="flex gap-2 border-t border-[var(--border)] pt-2"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_LIST_NAME}
            placeholder="Yeni liste adı (ör. SUV)"
            aria-label="Yeni liste adı"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button type="submit" disabled={busy || !name.trim()} className="btn btn-secondary !px-3" aria-label="Listeyi oluştur ve ekle">
            <Icon name="plus" size={15} />
          </button>
        </form>
      ) : (
        <p className="border-t border-[var(--border)] pt-2 text-xs text-slate-500">En fazla {MAX_FAVORITE_LISTS} liste açılabilir.</p>
      )}
    </div>
  );
}
