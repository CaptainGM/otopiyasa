import type { Types } from "mongoose";

/** Bir kullanıcı en fazla bu kadar ilanı favorileyebilir (liste ve belge şişmesin). */
export const MAX_FAVORITES = 500;
/** Bir kullanıcı en fazla bu kadar kendi listesini açabilir (varsayılan liste sayılmaz). */
export const MAX_FAVORITE_LISTS = 20;
export const MAX_LIST_NAME = 40;

/** Her kullanıcıda bulunan, silinemeyen ve adı değişmeyen varsayılan liste. Kendi listesine konmayan her favori buradadır. */
export const DEFAULT_LIST_ID = "default";
export const DEFAULT_LIST_NAME = "Favori Listem";

export interface FavoriteListDTO {
  id: string;
  name: string;
  carIds: string[];
  /** Varsayılan "Favori Listem" mi (silinemez, adı değişmez). */
  isDefault: boolean;
}

/** Liste adını temizler: boşlukları sadeleştirir, uzunluğu sınırlar. Boşsa null. */
export function normalizeListName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim().slice(0, MAX_LIST_NAME);
  return name.length > 0 ? name : null;
}

interface RawList {
  _id: Types.ObjectId;
  name?: string;
  carIds?: Types.ObjectId[];
}

/**
 * Varsayılan liste + kullanıcının kendi listeleri. Varsayılan listede, hiçbir kendi listesinde olmayan favoriler vardır;
 * böylece eski (listesiz) favoriler de kayıp olmadan "Favori Listem"de görünür.
 */
export function serializeFavoriteLists(
  lists: RawList[] | undefined | null,
  favoriteIds: Array<{ toString(): string }> | undefined | null
): FavoriteListDTO[] {
  const custom = (lists || []).map((list) => ({
    id: list._id.toString(),
    name: String(list.name || ""),
    carIds: (list.carIds || []).map((id) => id.toString()),
    isDefault: false,
  }));
  const placed = new Set(custom.flatMap((list) => list.carIds));
  const defaults = (favoriteIds || []).map((id) => id.toString()).filter((id) => !placed.has(id));
  return [{ id: DEFAULT_LIST_ID, name: DEFAULT_LIST_NAME, carIds: defaults, isDefault: true }, ...custom];
}
