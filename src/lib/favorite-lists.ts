import type { Types } from "mongoose";

/** Bir kullanıcı en fazla bu kadar ilanı favorileyebilir (liste ve belge şişmesin). */
export const MAX_FAVORITES = 500;
/** Bir kullanıcı en fazla bu kadar favori grubu açabilir. */
export const MAX_FAVORITE_LISTS = 20;
export const MAX_LIST_NAME = 40;

export interface FavoriteListDTO {
  id: string;
  name: string;
  carIds: string[];
}

/** Grup adını temizler: boşlukları sadeleştirir, uzunluğu sınırlar. Boşsa null. */
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

export function serializeFavoriteLists(lists: RawList[] | undefined | null): FavoriteListDTO[] {
  return (lists || []).map((list) => ({
    id: list._id.toString(),
    name: String(list.name || ""),
    carIds: (list.carIds || []).map((id) => id.toString()),
  }));
}
