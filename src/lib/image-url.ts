
const ARABAM_SIZE_LADDER = ["800x600", "1920x1080"];

const ARABAM_SIZE_RE = /_(\d{2,4}x\d{2,4})(\.(?:jpe?g|png|webp))(\?.*)?$/i;


export const CARD_IMAGE_SIZE = "800x600";


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
 * denemede resim gelir), ardından galerideki diğer fotoğraflar. Böylece tek bir
 * fotoğrafın silinmesi de, tüm ilanın 1920x1080 varyantının olmaması da kurtarılır.
 *
 * @param maxPhotos Kaç farklı fotoğrafa kadar inilsin (istek fırtınasını engeller).
 */
export function imageCandidates(
  src: string | undefined,
  fallbacks: string[] = [],
  maxPhotos = 6,
  preferSize?: string
): string[] {
  const photos: string[] = [];
  for (const url of [src, ...fallbacks]) {
    if (!url || photos.includes(url)) continue;
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
