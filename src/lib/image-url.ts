const ARABAM_SIZE_LADDER = ["800x600", "1920x1080"];

const ARABAM_SIZE_RE = /_(\d{2,4}x\d{2,4})(\.(?:jpe?g|png|webp))(\?.*)?$/i;

export const CARD_IMAGE_SIZE = "800x600";

/**
 * Kart küçük resmi için daha hafif varyant. Kartta en çok ~480 px genişlik gösterilir; kaynak
 * sitelerin galeri görselleri ise 1920 px geliyor (ölçüldü):
 *  - Carvak   w_1920,h_1080 → w_640,h_360     266 KB → 65 KB
 *  - Otoplus  _1920x1080    → _1280x720       135 KB → 66 KB (daha küçük boyutlar 403 veriyor)
 *  - Otokoç   /car/640x/    → /car/450x/       52 KB → 34 KB
 * Varyant yüklenemezse çağıran orijinal adresi yedek olarak verir (bkz. CardGallery).
 */
export function cardImageUrl(url: string): string {
  if (!url) return url;
  if (url.includes("img.carvak.co/") && url.includes("w_1920,h_1080")) {
    return url.replace("w_1920,h_1080", "w_640,h_360");
  }
  if (url.includes("cdn.otoplus.com/") && /_1920x1080.(jpe?g|webp|png)/i.test(url)) {
    return url.replace("_1920x1080.", "_1280x720.");
  }
  if (url.includes("2el-cdn.otokoc.com.tr/") && url.includes("/car/640x/")) {
    return url.replace("/car/640x/", "/car/450x/");
  }
  return url;
}

export function sanitizeImageUrl(url: string | undefined): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    return encodeURI(decodeURI(trimmed));
  } catch {
    return encodeURI(trimmed);
  }
}

export function sizeVariants(url: string, preferSize?: string): string[] {
  const match = url.match(ARABAM_SIZE_RE);
  if (!match) return [url];

  const [, currentSize, ext, query = ""] = match;
  const swap = (size: string) => url.replace(ARABAM_SIZE_RE, `_${size}${ext}${query}`);

  const sizes = [currentSize, ...ARABAM_SIZE_LADDER.filter((s) => s !== currentSize)];
  if (preferSize) {
    const rest = sizes.filter((s) => s !== preferSize);
    sizes.length = 0;
    sizes.push(preferSize, ...rest);
  }

  const out: string[] = [];
  for (const size of sizes) {
    const candidate = size === currentSize ? url : swap(size);
    if (!out.includes(candidate)) out.push(candidate);
  }
  return out;
}

/**
 * Bir araç için denenecek görsel adaylarının sıralı listesi.
 *
 * Sıra önemli: önce ANA fotoğrafın tüm boyut varyantları (bozuk ilanlarda ikinci
 * denemede resim gelir), ardından galerideki diğer fotoğraflar.
 */
export function imageCandidates(
  src: string | undefined,
  fallbacks: string[] = [],
  maxPhotos = 6,
  preferSize?: string
): string[] {
  const photos: string[] = [];
  for (const url of [src, ...fallbacks]) {
    if (!url || typeof url !== "string" || !url.trim() || photos.includes(url)) continue;
    photos.push(url);
    if (photos.length >= maxPhotos) break;
  }

  const candidates: string[] = [];
  for (const photo of photos) {
    for (const variant of sizeVariants(photo, preferSize)) {
      if (!candidates.includes(variant)) candidates.push(variant);
    }
  }
  return candidates;
}
