/**
 * FOTOĞRAF KÜÇÜLTME: bazı kaynaklar fotoğrafı küçük boyutta sunmuyor (VavaCars ve eski Carvak kayıtları
 * tek fotoğraf 0,5–1 MB, Otomerkezi ~100–150 KB, Otoplus yalnızca 1280 px). Bu adresler `/api/img` üzerinden istenir:
 * sunucu bir kez küçültür, CDN yıllarca saklar; kullanıcı ~15–25 KB indirir. Yalnızca aşağıdaki
 * kaynaklara izin verilir (açık proxy olmasın).
 */
export interface ProxyHost {
  /** Tam alan adı. */
  host: string;
  /** Kaynağın istediği Referer (yoksa gönderilmez). */
  referer?: string;
}

export const PROXY_HOSTS: ProxyHost[] = [
  { host: "dat-tr-prda-ops-vava.azureedge.net" },
  { host: "images.kavak.services" },
  { host: "asset.otomerkezi.net", referer: "https://www.otomerkezi.net/" },
  { host: "cdn.otoplus.com", referer: "https://www.otoplus.com/" },
];

export const IMAGE_PROXY_MIN_WIDTH = 160;
export const IMAGE_PROXY_MAX_WIDTH = 1280;
export const IMAGE_PROXY_DEFAULT_WIDTH = 480;

export function proxyHostFor(url: string): ProxyHost | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return PROXY_HOSTS.find((h) => h.host === u.hostname.toLowerCase()) ?? null;
  } catch {
    return null;
  }
}

export const isProxyableImage = (url: string) => proxyHostFor(url) !== null;

export function clampProxyWidth(width: number): number {
  if (!Number.isFinite(width)) return IMAGE_PROXY_DEFAULT_WIDTH;
  return Math.min(IMAGE_PROXY_MAX_WIDTH, Math.max(IMAGE_PROXY_MIN_WIDTH, Math.round(width)));
}

/**
 * Küçültülmüş adres. Genişlik 80 px'lik adımlara yuvarlanır: farklı ekranlar aynı önbellek
 * kaydını paylaşsın, sunucu aynı fotoğrafı onlarca boyutta işlemesin.
 */
export function proxiedImageUrl(url: string, width = IMAGE_PROXY_DEFAULT_WIDTH, base = ""): string {
  const w = clampProxyWidth(Math.ceil(width / 80) * 80);
  return `${base}/api/img?u=${encodeURIComponent(url)}&w=${w}`;
}
