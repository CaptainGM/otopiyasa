import sharp from "sharp";
import { createAvatar } from "@dicebear/core";
import * as lorelei from "@dicebear/lorelei";
import * as notionists from "@dicebear/notionists";
import * as openPeeps from "@dicebear/open-peeps";
import * as thumbs from "@dicebear/thumbs";
import { AVATAR_SEED_COUNT, AVATAR_STYLES, type AvatarStyleId } from "@/lib/avatar";

/** Hazır avatarların çizim stilleri; hepsi CC0 (atıf gerekmez). */
const STYLES: Record<AvatarStyleId, Parameters<typeof createAvatar>[0]> = {
  lorelei,
  notionists,
  "open-peeps": openPeeps,
  thumbs,
} as unknown as Record<AvatarStyleId, Parameters<typeof createAvatar>[0]>;

/** Yumuşak arka plan renkleri (tohuma göre seçilir; saydam stillerde de düzgün görünür). */
const BACKGROUNDS = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf", "c7f0d8", "fde68a", "e2e8f0"];

export const AVATAR_PRESET_PX = 256;

/**
 * Stil başına ek ayarlar. Open Peeps'te korkutucu/saldırgan yüzler, tek gözlü ve canavar çizimler, maske ve göz bandı hiç seçilmez:
 * profil resmi olarak "güleryüzlü ve nötr" kalsın diye yüz seti elle daraltılmıştır.
 */
const STYLE_OPTIONS: Partial<Record<AvatarStyleId, Record<string, unknown>>> = {
  "open-peeps": {
    face: ["awe", "blank", "calm", "cheeky", "cute", "driven", "eyesClosed", "lovingGrin1", "lovingGrin2", "old", "serious", "smile", "smileBig", "smileLOL", "smileTeethGap", "solemn", "tired", "explaining"],
    maskProbability: 0,
    accessories: ["glasses", "glasses2", "glasses3", "glasses4", "glasses5", "sunglasses", "sunglasses2"],
  },
};

export function isPresetRequest(style: string, seed: string): { style: AvatarStyleId; seed: number } | null {
  const id = AVATAR_STYLES.find((item) => item.id === style)?.id;
  if (!id || !/^\d{1,3}$/.test(seed)) return null;
  const n = Number(seed);
  return n >= 0 && n < AVATAR_SEED_COUNT ? { style: id, seed: n } : null;
}

/** Hazır avatarı PNG olarak çizer (web ve mobil aynı görüntüyü kullanır). */
export async function renderPresetPng(style: AvatarStyleId, seed: number): Promise<Buffer> {
  const svg = createAvatar(STYLES[style], {
    seed: `${style}-${seed}`,
    size: AVATAR_PRESET_PX,
    backgroundColor: BACKGROUNDS,
    ...STYLE_OPTIONS[style],
  } as Parameters<typeof createAvatar>[1]).toString();
  return sharp(Buffer.from(svg)).resize(AVATAR_PRESET_PX, AVATAR_PRESET_PX).png({ compressionLevel: 9 }).toBuffer();
}
