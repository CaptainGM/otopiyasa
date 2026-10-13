/**
 * Keşfet akışının dilim isteği adresi. İstemci (components/InfiniteCarList.tsx) ve ısıtıcı (lib/feed-warm.ts, VM'deki motor)
 * AYNI işlevlerle kurar: CDN önbelleği adresin tamamına (parametre sırası dahil) göre saklanır; sıra farklı olsa ısıtılan yanıt
 * kullanıcıya hiç denk gelmezdi.
 */

/** Sorguya dilim ve dönem eklenir (seed atılır): "limit=24" → "limit=24&slot=7&b=1990997". */
export function feedSliceQuery(query: string, slot: number, bucket: number): string {
  const params = new URLSearchParams(query);
  params.delete("seed");
  params.set("slot", String(slot));
  params.set("b", String(bucket));
  return params.toString();
}

/** Bir sayfanın tam sorgusu: "limit=24&slot=7&b=1990997&page=1&compact=1". */
export function feedPageQuery(sliceQuery: string, page: number, limit: number): string {
  const params = new URLSearchParams(sliceQuery);
  params.set("page", String(page));
  params.set("limit", String(limit));
  params.set("compact", "1");
  return params.toString();
}
