/**
 * PROFİL FOTOĞRAFI: ya hazır avatar (çizim; yalnızca kimlik saklanır) ya da kullanıcının kendi fotoğrafı (sunucuda küçültülür,
 * denetlenir ve ayrı koleksiyonda saklanır).
 */

/**
 * Hazır avatarlar: DiceBear çizim stilleri (hepsi CC0, atıf gerekmez), tohum 0-999. Kimlik "lorelei.42"; görüntü sunucuda çizilir ve
 * PNG olarak sunulur (/api/avatar/preset/[stil]/[tohum]), böylece web ve mobil aynı adresi kullanır. Tohum uzayı bilerek sınırlı:
 * adresler CDN'de değişmez saklanır ve rastgele adresle sunucu işlemcisi tüketilemez.
 */
export const AVATAR_STYLES = [
  { id: "lorelei", label: "Portre" },
  { id: "notionists", label: "Çizim" },
  { id: "open-peeps", label: "Karakter" },
  { id: "thumbs", label: "Sevimli" },
] as const;
export type AvatarStyleId = (typeof AVATAR_STYLES)[number]["id"];

export const AVATAR_SEED_COUNT = 1000;
export const AVATAR_PRESET_COUNT = AVATAR_STYLES.length * AVATAR_SEED_COUNT;

export const presetId = (style: AvatarStyleId, seed: number) => `${style}.${seed}`;
export const presetImagePath = (style: string, seed: number) => `/api/avatar/preset/${style}/${seed}`;

/** "lorelei.42" → { style: "lorelei", seed: 42 }; geçersizse null. */
export function parseAvatarPreset(id: unknown): { style: AvatarStyleId; seed: number } | null {
  if (typeof id !== "string") return null;
  const parts = id.split(".");
  if (parts.length !== 2 || !/^\d{1,3}$/.test(parts[1])) return null;
  const style = AVATAR_STYLES.find((item) => item.id === parts[0])?.id;
  const seed = Number(parts[1]);
  if (!style || !Number.isInteger(seed) || seed < 0 || seed >= AVATAR_SEED_COUNT) return null;
  return { style, seed };
}

/** Arayüze (web ve mobil) giden avatar tarifi: ikisinde de görüntü bir adresten gelir. */
export type AvatarDescriptor = { type: "preset"; preset: string; url: string } | { type: "photo"; url: string } | null;

interface AvatarFields {
  _id?: unknown;
  avatarType?: string | null;
  avatarPreset?: string | null;
  avatarVersion?: number | null;
}

/** Kullanıcı kaydından arayüze gidecek avatar tarifi. */
export function avatarDescriptor(user: AvatarFields | null | undefined): AvatarDescriptor {
  if (!user) return null;
  if (user.avatarType === "photo" && user._id) return { type: "photo", url: `/api/avatar/${String(user._id)}?v=${user.avatarVersion || 1}` };
  const parsed = user.avatarType === "preset" ? parseAvatarPreset(user.avatarPreset) : null;
  if (parsed) return { type: "preset", preset: user.avatarPreset as string, url: presetImagePath(parsed.style, parsed.seed) };
  return null;
}

// --- Yüklenen fotoğraf ---------------------------------------------------------------------------------------------

/** Sunucuya gelen (istemcide küçültülmüş) görüntünün üst boyut sınırı. */
export const AVATAR_MAX_UPLOAD_BYTES = 400 * 1024;
export const AVATAR_SIZE_PX = 256;

export type DetectedImage = { mime: "image/jpeg" | "image/png" | "image/webp"; bytes: Buffer };

/** Dosya başlığına (sihirli baytlara) bakarak türü saptar; SVG ve diğerleri reddedilir. Bildirilen türe güvenilmez. */
export function detectImageType(bytes: Buffer): DetectedImage["mime"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

/** "data:image/jpeg;base64,..." metnini çözer ve doğrular. Hata iletisi kullanıcıya gösterilir. */
export function decodeImageDataUrl(dataUrl: unknown): { ok: true; image: DetectedImage } | { ok: false; error: string } {
  if (typeof dataUrl !== "string") return { ok: false, error: "Fotoğraf okunamadı." };
  const match = /^data:image\/[a-z+.-]+;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return { ok: false, error: "Fotoğraf biçimi anlaşılamadı." };
  // Base64 uzunluğundan çözülmüş boyut tahmini: tamponu açmadan büyük yüklemeyi reddet.
  if (Math.floor((match[1].length * 3) / 4) > AVATAR_MAX_UPLOAD_BYTES) return { ok: false, error: "Fotoğraf çok büyük (en fazla 400 KB)." };
  const bytes = Buffer.from(match[1], "base64");
  const mime = detectImageType(bytes);
  if (!mime) return { ok: false, error: "Yalnızca JPEG, PNG ya da WebP fotoğraf yükleyebilirsin." };
  return { ok: true, image: { mime, bytes } };
}
