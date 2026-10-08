import type { FavoriteListDTO } from "@/lib/favorite-lists";

export interface ListsResponse {
  ok: boolean;
  status: number;
  lists?: FavoriteListDTO[];
  error?: string;
}

/** Favori grubu uçlarına istek atar; her başarılı yanıt güncel grup listesini döner. */
export async function listsRequest(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<ListsResponse> {
  try {
    const response = await fetch(`/api/favorites/lists${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, status: response.status, error: data?.error || "İşlem yapılamadı." };
    return { ok: true, status: response.status, lists: data.lists as FavoriteListDTO[] };
  } catch {
    return { ok: false, status: 0, error: "Bağlantı kurulamadı." };
  }
}
