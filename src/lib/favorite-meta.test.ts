import { describe, expect, it } from "vitest";
import { DEFAULT_META, alertChannels, isDefaultMeta, mergeMetaInput, toMetaDTO } from "./favorite-meta";

describe("toMetaDTO", () => {
  it("kayıt yoksa varsayılan: her düşüşte, e-posta + bildirim", () => {
    expect(toMetaDTO(null)).toEqual(DEFAULT_META);
    expect(isDefaultMeta(toMetaDTO(undefined))).toBe(true);
  });

  it("hedef fiyat yalnızca 'below' kipinde okunur", () => {
    expect(toMetaDTO({ alertMode: "any", alertBelow: 900000 }).alertBelow).toBeNull();
    expect(toMetaDTO({ alertMode: "below", alertBelow: 900000 }).alertBelow).toBe(900000);
  });
});

describe("mergeMetaInput", () => {
  it("notu temizler ve kısaltır", () => {
    const result = mergeMetaInput(DEFAULT_META, { note: `  ${"a ".repeat(400)} ` });
    expect("meta" in result && result.meta.note.length).toBeLessThanOrEqual(300);
  });

  it("hedef fiyat olmadan 'below' kabul edilmez", () => {
    expect(mergeMetaInput(DEFAULT_META, { alertMode: "below" })).toEqual({ error: "Hedef fiyatı yaz." });
  });

  it("hedef fiyatla 'below' kabul edilir, diğer kipte fiyat silinir", () => {
    const below = mergeMetaInput(DEFAULT_META, { alertMode: "below", alertBelow: 850000.4 });
    expect(below).toEqual({ meta: { ...DEFAULT_META, alertMode: "below", alertBelow: 850000 } });
    if (!("meta" in below)) throw new Error("beklenmedik");
    const any = mergeMetaInput(below.meta, { alertMode: "any" });
    expect("meta" in any && any.meta.alertBelow).toBeNull();
  });

  it("hiç bildirim yolu seçilmeden açık kip reddedilir; kapalı kip serbest", () => {
    expect(mergeMetaInput(DEFAULT_META, { alertEmail: false, alertPush: false })).toHaveProperty("error");
    expect(mergeMetaInput(DEFAULT_META, { alertMode: "off", alertEmail: false, alertPush: false })).toHaveProperty("meta");
  });

  it("geçersiz türleri reddeder", () => {
    expect(mergeMetaInput(DEFAULT_META, { alertMode: "x" })).toHaveProperty("error");
    expect(mergeMetaInput(DEFAULT_META, { alertBelow: -5 })).toHaveProperty("error");
    expect(mergeMetaInput(DEFAULT_META, { alertPush: "evet" })).toHaveProperty("error");
  });
});

describe("alertChannels", () => {
  it("varsayılan her düşüşte iki yola da gönderir", () => {
    expect(alertChannels(DEFAULT_META, 100)).toEqual({ email: true, push: true });
  });

  it("yalnızca mobil seçildiyse e-posta gitmez", () => {
    expect(alertChannels({ ...DEFAULT_META, alertEmail: false }, 100)).toEqual({ email: false, push: true });
  });

  it("hedef fiyatın üstündeki düşüş bildirim üretmez, eşit ya da altı üretir", () => {
    const meta = { ...DEFAULT_META, alertMode: "below" as const, alertBelow: 900000 };
    expect(alertChannels(meta, 910000)).toEqual({ email: false, push: false });
    expect(alertChannels(meta, 900000)).toEqual({ email: true, push: true });
    expect(alertChannels(meta, 850000)).toEqual({ email: true, push: true });
  });

  it("kapalıysa hiçbir yola gitmez", () => {
    expect(alertChannels({ ...DEFAULT_META, alertMode: "off" }, 1)).toEqual({ email: false, push: false });
  });
});
