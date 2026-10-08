export type AlertMode = "any" | "below" | "off";

export const MAX_NOTE_LENGTH = 300;

export interface FavoriteMetaDTO {
  note: string;
  alertMode: AlertMode;
  /** alertMode "below" iken hedef fiyat (TL). */
  alertBelow: number | null;
  alertEmail: boolean;
  alertPush: boolean;
}

export const DEFAULT_META: FavoriteMetaDTO = {
  note: "",
  alertMode: "any",
  alertBelow: null,
  alertEmail: true,
  alertPush: true,
};

interface RawMeta {
  note?: string;
  alertMode?: string;
  alertBelow?: number | null;
  alertEmail?: boolean;
  alertPush?: boolean;
}

export function toMetaDTO(raw: RawMeta | null | undefined): FavoriteMetaDTO {
  if (!raw) return { ...DEFAULT_META };
  const mode: AlertMode = raw.alertMode === "below" || raw.alertMode === "off" ? raw.alertMode : "any";
  return {
    note: String(raw.note || ""),
    alertMode: mode,
    alertBelow: mode === "below" && typeof raw.alertBelow === "number" ? raw.alertBelow : null,
    alertEmail: raw.alertEmail !== false,
    alertPush: raw.alertPush !== false,
  };
}

/** Varsayılandan farksızsa kayıt tutmaya gerek yoktur. */
export function isDefaultMeta(meta: FavoriteMetaDTO): boolean {
  return (
    meta.note === "" &&
    meta.alertMode === "any" &&
    meta.alertBelow === null &&
    meta.alertEmail === true &&
    meta.alertPush === true
  );
}

/**
 * İstemciden gelen kısmi güncellemeyi mevcut ayarla birleştirir ve doğrular.
 * Hata varsa kullanıcıya gösterilecek metni döner.
 */
export function mergeMetaInput(
  current: FavoriteMetaDTO,
  input: Record<string, unknown>
): { meta: FavoriteMetaDTO } | { error: string } {
  const next: FavoriteMetaDTO = { ...current };

  if (input.note !== undefined) {
    if (typeof input.note !== "string") return { error: "Not metin olmalı." };
    next.note = input.note.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE_LENGTH);
  }
  if (input.alertMode !== undefined) {
    if (input.alertMode !== "any" && input.alertMode !== "below" && input.alertMode !== "off") {
      return { error: "Geçersiz bildirim türü." };
    }
    next.alertMode = input.alertMode;
  }
  if (input.alertBelow !== undefined) {
    if (input.alertBelow === null) next.alertBelow = null;
    else if (typeof input.alertBelow === "number" && Number.isFinite(input.alertBelow) && input.alertBelow > 0 && input.alertBelow < 1e10) {
      next.alertBelow = Math.round(input.alertBelow);
    } else return { error: "Hedef fiyat geçerli bir sayı olmalı." };
  }
  if (input.alertEmail !== undefined) {
    if (typeof input.alertEmail !== "boolean") return { error: "Geçersiz e-posta tercihi." };
    next.alertEmail = input.alertEmail;
  }
  if (input.alertPush !== undefined) {
    if (typeof input.alertPush !== "boolean") return { error: "Geçersiz bildirim tercihi." };
    next.alertPush = input.alertPush;
  }

  if (next.alertMode === "below") {
    if (next.alertBelow === null) return { error: "Hedef fiyatı yaz." };
  } else {
    next.alertBelow = null;
  }
  if (next.alertMode !== "off" && !next.alertEmail && !next.alertPush) {
    return { error: "En az bir bildirim yolu seç (e-posta ya da mobil bildirim)." };
  }
  return { meta: next };
}

/** Bir fiyat düşüşünde bu kullanıcıya hangi yoldan bildirim gideceği. */
export function alertChannels(meta: FavoriteMetaDTO, newPrice: number): { email: boolean; push: boolean } {
  if (meta.alertMode === "off") return { email: false, push: false };
  if (meta.alertMode === "below" && (meta.alertBelow === null || newPrice > meta.alertBelow)) {
    return { email: false, push: false };
  }
  return { email: meta.alertEmail, push: meta.alertPush };
}
