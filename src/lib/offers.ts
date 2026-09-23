import type { OfferStatus } from "@/models/Offer";


export const OFFER_CHAT_WINDOW_MS = 48 * 60 * 60 * 1000;


export const MIN_OFFER_PRICE = 20_000;


export const MIN_OFFER_RATIO = 0.3;

export interface OfferValidation {
  valid: boolean;
  error?: string;
}


export function effectiveOfferFloor(listingPrice: number, minOffer?: number | null): number {
  if (minOffer && minOffer > 0) return Math.max(MIN_OFFER_PRICE, Math.round(minOffer));
  if (listingPrice > 0) return Math.max(MIN_OFFER_PRICE, Math.round(listingPrice * MIN_OFFER_RATIO));
  return MIN_OFFER_PRICE;
}

/**
 * Teklif tutarı kabul edilebilir mi?
 *
 * @param minOffer Satıcının ilanda belirlediği alt sınır (varsa).
 */
export function validateOfferAmount(
  amount: number,
  listingPrice: number,
  minOffer?: number | null
): OfferValidation {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, error: "Geçerli bir teklif tutarı gir." };
  }
  if (!Number.isInteger(amount)) {
    return { valid: false, error: "Teklif tutarı tam sayı olmalı." };
  }

  const floor = effectiveOfferFloor(listingPrice, minOffer);
  if (amount < floor) {
    
    return {
      valid: false,
      error:
        minOffer && minOffer > 0
          ? `Satıcı bu ilan için en az ${floor.toLocaleString("tr-TR")} ₺ teklif kabul ediyor.`
          : `Teklif en az ${floor.toLocaleString("tr-TR")} ₺ olabilir.`,
    };
  }

 
  if (listingPrice > 0 && amount > listingPrice) {
    return {
      valid: false,
      error: `Teklif, ilan fiyatını (${listingPrice.toLocaleString("tr-TR")} ₺) geçemez.`,
    };
  }
  return { valid: true };
}


export function validateMinOffer(minOffer: number, listingPrice: number): OfferValidation {
  if (!minOffer) return { valid: true }; // belirtilmemiş
  if (!Number.isFinite(minOffer) || !Number.isInteger(minOffer) || minOffer < 0) {
    return { valid: false, error: "Minimum teklif tutarı geçerli bir sayı olmalı." };
  }
  if (minOffer < MIN_OFFER_PRICE) {
    return {
      valid: false,
      error: `Minimum teklif en az ${MIN_OFFER_PRICE.toLocaleString("tr-TR")} ₺ olabilir.`,
    };
  }
  if (listingPrice > 0 && minOffer > listingPrice) {
    return {
      valid: false,
      error: "Minimum teklif, ilan fiyatından yüksek olamaz.",
    };
  }
  return { valid: true };
}


export function chatExpiryFrom(acceptedAt: Date): Date {
  return new Date(acceptedAt.getTime() + OFFER_CHAT_WINDOW_MS);
}


export function effectiveStatus(
  status: OfferStatus,
  expiresAt: Date | null | undefined,
  now: Date = new Date()
): OfferStatus {
  if (status === "accepted" && expiresAt && now.getTime() > new Date(expiresAt).getTime()) {
    return "expired";
  }
  return status;
}


export function canSendMessage(
  status: OfferStatus,
  expiresAt: Date | null | undefined,
  now: Date = new Date()
): boolean {
  return effectiveStatus(status, expiresAt, now) === "accepted";
}


export function canSubmitNewOffer(
  status: OfferStatus,
  expiresAt: Date | null | undefined,
  now: Date = new Date()
): boolean {
  const real = effectiveStatus(status, expiresAt, now);
  return real === "rejected" || real === "expired";
}


export function canRespond(
  status: OfferStatus,
  expiresAt: Date | null | undefined,
  now: Date = new Date()
): boolean {
  return effectiveStatus(status, expiresAt, now) === "pending";
}


export function remainingMs(
  status: OfferStatus,
  expiresAt: Date | null | undefined,
  now: Date = new Date()
): number | null {
  if (status !== "accepted" || !expiresAt) return null;
  return Math.max(0, new Date(expiresAt).getTime() - now.getTime());
}


export function formatRemaining(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0 && minutes <= 0) return "süre doldu";
  if (hours <= 0) return `${minutes} dakika`;
  if (minutes === 0) return `${hours} saat`;
  return `${hours} saat ${minutes} dakika`;
}


export function statusLabel(status: OfferStatus): string {
  switch (status) {
    case "pending":
      return "Yanıt bekliyor";
    case "accepted":
      return "Kabul edildi";
    case "rejected":
      return "Reddedildi";
    case "expired":
      return "Süresi doldu";
  }
}
