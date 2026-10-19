/**
 * Talep / şikayet formunun doğrulaması (saf fonksiyon: API ve testler kullanır).
 * Genel talepler (şikayet, hata bildirimi, KVKK veri talebi, öneri) ilan ya da sohbet şikayetinden ayrıdır; onlar Report modelinde kalır.
 */

export const REQUEST_TYPES = ["sikayet", "bildirim", "kvkk", "oneri", "diger"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  sikayet: "Şikayet",
  bildirim: "Hata / sorun bildirimi",
  kvkk: "Kişisel veri talebi (KVKK)",
  oneri: "Öneri",
  diger: "Diğer",
};

export const REQUEST_STATUSES = ["open", "in_review", "resolved", "rejected"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  open: "Açık",
  in_review: "İncelemede",
  resolved: "Çözüldü",
  rejected: "Reddedildi",
};

export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 120;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
export const NAME_MAX = 80;
export const EMAIL_MAX = 200;
export const ADMIN_NOTE_MAX = 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const CAR_URL_RE = /\/cars\/([a-f0-9]{24})(?:[/?#]|$)/i;

export type ValidRequest =
  | { spam: true }
  | {
      spam: false;
      type: RequestType;
      subject: string;
      message: string;
      email: string;
      name: string;
      carId: string | null;
    };

export type RequestCheck = { ok: true; value: ValidRequest } | { ok: false; error: string };

/** İlgili ilan: ilan kimliği ya da ilan bağlantısı (…/cars/<kimlik>). Boşsa null, tanınmazsa "invalid". */
export function parseCarRef(raw: string): string | null | "invalid" {
  const value = raw.trim();
  if (!value) return null;
  if (OBJECT_ID_RE.test(value)) return value.toLowerCase();
  const fromUrl = value.match(CAR_URL_RE);
  if (fromUrl) return fromUrl[1].toLowerCase();
  return "invalid";
}

export function validateRequest(input: Record<string, unknown>, options: { loggedIn: boolean }): RequestCheck {
  // Gizli alan (honeypot): botlar doldurur. Doluysa hata vermeden kabul edilir ama kayıt yapılmaz.
  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: true, value: { spam: true } };
  }
  if (input.consent !== true) {
    return { ok: false, error: "Devam etmek için kişisel verilerin bu talep için işlenmesine onay vermelisin." };
  }
  const type = String(input.type ?? "");
  if (!(REQUEST_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: "Talep türü seçilmedi." };
  }
  const subject = String(input.subject ?? "").trim();
  if (subject.length < SUBJECT_MIN || subject.length > SUBJECT_MAX) {
    return { ok: false, error: `Konu ${SUBJECT_MIN}–${SUBJECT_MAX} karakter olmalı.` };
  }
  const message = String(input.message ?? "").trim();
  if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) {
    return { ok: false, error: `Mesaj ${MESSAGE_MIN}–${MESSAGE_MAX} karakter olmalı.` };
  }
  const email = String(input.email ?? "").trim().toLowerCase();
  if (email && (email.length > EMAIL_MAX || !EMAIL_RE.test(email))) {
    return { ok: false, error: "E-posta adresi geçersiz." };
  }
  if (!options.loggedIn && !email) {
    return { ok: false, error: "Yanıt verebilmemiz için e-posta adresi gerekli." };
  }
  const name = String(input.name ?? "").trim().slice(0, NAME_MAX);
  const carId = parseCarRef(String(input.carRef ?? ""));
  if (carId === "invalid") return { ok: false, error: "İlgili ilan bağlantısı geçersiz." };
  return {
    ok: true,
    value: { spam: false, type: type as RequestType, subject, message, email, name, carId },
  };
}
