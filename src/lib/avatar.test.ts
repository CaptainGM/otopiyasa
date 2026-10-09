import { describe, expect, it } from "vitest";
import {
  AVATAR_MAX_UPLOAD_BYTES,
  AVATAR_PRESET_COUNT,
  AVATAR_SEED_COUNT,
  AVATAR_STYLES,
  avatarDescriptor,
  decodeImageDataUrl,
  detectImageType,
  parseAvatarPreset,
  presetId,
} from "./avatar";
import { isPresetRequest } from "./avatar-render";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBPVP8 ")]);
const toUrl = (mime: string, b: Buffer) => `data:${mime};base64,${b.toString("base64")}`;

describe("hazır avatarlar", () => {
  it("binlerce seçenek üretir ve kimliği doğrular", () => {
    expect(AVATAR_PRESET_COUNT).toBe(AVATAR_STYLES.length * AVATAR_SEED_COUNT);
    expect(AVATAR_PRESET_COUNT).toBeGreaterThanOrEqual(4000);
    expect(parseAvatarPreset(presetId("lorelei", 42))).toEqual({ style: "lorelei", seed: 42 });
    expect(parseAvatarPreset("thumbs.999")).toEqual({ style: "thumbs", seed: 999 });
  });

  it("geçersiz kimlikleri reddeder", () => {
    for (const bad of ["", "lorelei", "lorelei.", "lorelei.1000", "lorelei.-1", "lorelei.1.2", "nope.1", "<script>.1", "lorelei.1e2", null, 5]) {
      expect(parseAvatarPreset(bad)).toBeNull();
    }
  });

  it("sunum rotası yalnızca tanımlı stil ve 0-999 tohum kabul eder", () => {
    expect(isPresetRequest("lorelei", "7")).toEqual({ style: "lorelei", seed: 7 });
    expect(isPresetRequest("lorelei", "1000")).toBeNull();
    expect(isPresetRequest("../etc", "1")).toBeNull();
    expect(isPresetRequest("lorelei", "abc")).toBeNull();
  });
});

describe("avatarDescriptor", () => {
  it("fotoğraf için sürümlü adres verir", () => {
    expect(avatarDescriptor({ _id: "abc", avatarType: "photo", avatarVersion: 7 })).toEqual({ type: "photo", url: "/api/avatar/abc?v=7" });
  });
  it("hazır avatar için görüntü adresi verir, geçersizi ve boşu null yapar", () => {
    expect(avatarDescriptor({ avatarType: "preset", avatarPreset: "lorelei.2" })).toEqual({ type: "preset", preset: "lorelei.2", url: "/api/avatar/preset/lorelei/2" });
    expect(avatarDescriptor({ avatarType: "preset", avatarPreset: "x.2" })).toBeNull();
    expect(avatarDescriptor({})).toBeNull();
    expect(avatarDescriptor(null)).toBeNull();
  });
});

describe("detectImageType", () => {
  it("türü başlıktan bulur", () => {
    expect(detectImageType(jpeg)).toBe("image/jpeg");
    expect(detectImageType(png)).toBe("image/png");
    expect(detectImageType(webp)).toBe("image/webp");
  });
  it("SVG, GIF ve rastgele veriyi reddeder", () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageType(Buffer.from("GIF89a....."))).toBeNull();
    expect(detectImageType(Buffer.from([1, 2, 3]))).toBeNull();
  });
});

describe("decodeImageDataUrl", () => {
  it("geçerli JPEG'i kabul eder", () => {
    expect(decodeImageDataUrl(toUrl("image/jpeg", jpeg)).ok).toBe(true);
  });
  it("bildirilen tür JPEG ama içerik SVG ise reddeder", () => {
    expect(decodeImageDataUrl(toUrl("image/jpeg", Buffer.from("<svg onload=alert(1)>"))).ok).toBe(false);
  });
  it("çok büyük yüklemeyi reddeder", () => {
    const big = Buffer.concat([jpeg, Buffer.alloc(AVATAR_MAX_UPLOAD_BYTES + 10)]);
    expect(decodeImageDataUrl(toUrl("image/jpeg", big))).toEqual({ ok: false, error: "Fotoğraf çok büyük (en fazla 400 KB)." });
  });
  it("data adresi olmayan girdiyi reddeder", () => {
    expect(decodeImageDataUrl("http://evil/x.jpg").ok).toBe(false);
    expect(decodeImageDataUrl(undefined).ok).toBe(false);
  });
});
