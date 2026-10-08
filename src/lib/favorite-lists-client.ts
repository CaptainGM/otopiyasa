import type { FavoriteListDTO } from "@/lib/favorite-lists";
import type { FavoriteMetaDTO } from "@/lib/favorite-meta";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function call<T>(path: string, method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, status: response.status, error: data?.error || "İşlem yapılamadı." };
    return { ok: true, status: response.status, data: data as T };
  } catch {
    return { ok: false, status: 0, error: "Bağlantı kurulamadı." };
  }
}

type ListsData = { lists: FavoriteListDTO[]; createdId?: string };

/** Favori ilan listeleri ve ilan ayarları için istemci çağrıları (hepsi güncel listeleri döner). */
export const favoriteApi = {
  state: () => call<{ ids: string[]; lists: FavoriteListDTO[]; meta: Record<string, FavoriteMetaDTO> }>("/api/favorites?ids=1", "GET"),
  add: (carId: string, listId?: string) => call<{ success: true }>("/api/favorites", "POST", { carId, listId }),
  remove: (carId: string) => call<{ success: true }>("/api/favorites", "DELETE", { carId }),
  createList: (name: string, carId?: string) => call<ListsData>("/api/favorites/lists", "POST", { name, carId }),
  renameList: (listId: string, name: string) => call<ListsData>(`/api/favorites/lists/${listId}`, "PATCH", { name }),
  deleteList: (listId: string) => call<ListsData>(`/api/favorites/lists/${listId}`, "DELETE"),
  /** İlanı bu listeye taşır (favorilerde değilse ekler). */
  moveToList: (listId: string, carId: string) => call<ListsData>(`/api/favorites/lists/${listId}`, "PATCH", { add: carId }),
  saveMeta: (carId: string, patch: Partial<FavoriteMetaDTO>) => call<{ meta: FavoriteMetaDTO }>("/api/favorites/meta", "PUT", { carId, ...patch }),
};

/** Fiyat bildirimi ayarının tek satırlık özeti (kartta ve menüde gösterilir). */
export function alertSummary(meta: FavoriteMetaDTO | undefined): string {
  if (!meta) return "Her fiyat düşüşünde";
  if (meta.alertMode === "off") return "Bildirim kapalı";
  const channels = [meta.alertEmail ? "e-posta" : "", meta.alertPush ? "mobil" : ""].filter(Boolean).join(" + ");
  const when = meta.alertMode === "below" && meta.alertBelow ? `${meta.alertBelow.toLocaleString("tr-TR")} ₺ altına düşünce` : "Her fiyat düşüşünde";
  return `${when} · ${channels}`;
}
