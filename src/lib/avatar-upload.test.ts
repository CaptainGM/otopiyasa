import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectImageType } from "./avatar";
import { normalizeAvatar } from "./avatar-upload";
import { verdictFromCategory } from "./avatar-moderation";

describe("normalizeAvatar", () => {
  it("büyük dikdörtgen görüntüyü 256x256 JPEG'e çevirir ve EXIF'i atar", async () => {
    const source = await sharp({ create: { width: 900, height: 500, channels: 3, background: "#336699" } })
      .withExif({ IFD0: { Copyright: "gizli" } })
      .png()
      .toBuffer();
    const out = await normalizeAvatar({ mime: "image/png", bytes: source });
    expect(detectImageType(out)).toBe("image/jpeg");
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([256, 256]);
    expect(meta.exif).toBeUndefined();
  });

  it("görüntü olmayan veriyi reddeder", async () => {
    await expect(normalizeAvatar({ mime: "image/jpeg", bytes: Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]) })).rejects.toThrow();
  });
});

describe("verdictFromCategory", () => {
  it("yalnızca 'safe' kabul edilir", () => {
    expect(verdictFromCategory("safe")).toEqual({ ok: true });
    for (const c of ["nudity_sexual", "violence_gore", "terror_extremist", "hate_symbol", "political", "weapons_drugs"]) {
      const v = verdictFromCategory(c);
      expect(v.ok).toBe(false);
    }
  });
  it("tanınmayan ya da boş çıktı güvenli sayılmaz", () => {
    expect(verdictFromCategory("ok").ok).toBe(false);
    expect(verdictFromCategory(undefined).ok).toBe(false);
    expect(verdictFromCategory(null).ok).toBe(false);
  });
});
