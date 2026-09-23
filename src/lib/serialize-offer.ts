import { effectiveStatus, remainingMs, canSendMessage, canRespond, canSubmitNewOffer } from "@/lib/offers";
import type { OfferStatus } from "@/models/Offer";
import { maskName } from "@/lib/form-options";
import { assessMessageRisk, ChatRiskFlag } from "@/lib/chat-safety";



export interface OfferEventView {
  id: string;
  kind: "offer" | "accepted" | "rejected" | "message" | "expired";
  amount: number | null;
  text: string;
  createdAt: string;

  mine: boolean;
 
  riskFlags: ChatRiskFlag[];
}

export interface OfferView {
  id: string;
  carId: string;
  carTitle: string;
  carImage: string;
  carPrice: number;
  amount: number;
  status: OfferStatus;
  
  role: "buyer" | "seller";
  counterpartName: string;
 
  sellerPhone: string;
  chatOpen: boolean;
  canRespond: boolean;
  canOfferAgain: boolean;

  remainingMs: number | null;
  events: OfferEventView[];
  updatedAt: string;
}

interface PopulatedRef {
  _id?: { toString(): string };
  name?: string;
  title?: string;
  imageUrl?: string;
  price?: number;
  contactPhone?: string;
}

export interface LeanOffer {
  _id: { toString(): string };
  car?: PopulatedRef | null;
  buyer?: PopulatedRef | null;
  seller?: PopulatedRef | null;
  amount: number;
  status: OfferStatus;
  expiresAt?: Date | null;
  events?: {
    _id?: { toString(): string };
    kind: OfferEventView["kind"];
    author?: { toString(): string } | null;
    amount?: number | null;
    text?: string;
    createdAt?: Date;
  }[];
  updatedAt?: Date;
}

const idOf = (ref: unknown): string => {
  if (!ref) return "";
  if (typeof ref === "string") return ref;
  const obj = ref as { _id?: { toString(): string }; toString(): string };
  return obj._id ? obj._id.toString() : obj.toString();
};

export function serializeOffer(offer: LeanOffer, viewerId: string, now: Date = new Date()): OfferView {
  const status = effectiveStatus(offer.status, offer.expiresAt, now);
  const sellerId = idOf(offer.seller);
  const role: "buyer" | "seller" = sellerId === viewerId ? "seller" : "buyer";
  const counterpart = role === "seller" ? offer.buyer : offer.seller;

  return {
    id: offer._id.toString(),
    carId: idOf(offer.car),
    carTitle: offer.car?.title || "İlan",
    carImage: offer.car?.imageUrl || "",
    carPrice: offer.car?.price ?? 0,
    amount: offer.amount,
    status,
    role,
    
    counterpartName: maskName(counterpart?.name || ""),
    
    sellerPhone:
      role === "buyer" && canSendMessage(offer.status, offer.expiresAt, now)
        ? offer.car?.contactPhone || ""
        : "",
    chatOpen: canSendMessage(offer.status, offer.expiresAt, now),
    
    canRespond: role === "seller" && canRespond(offer.status, offer.expiresAt, now),
    canOfferAgain: role === "buyer" && canSubmitNewOffer(offer.status, offer.expiresAt, now),
    remainingMs: remainingMs(offer.status, offer.expiresAt, now),
    events: (offer.events || []).map((e, i) => ({
      id: e._id?.toString() || String(i),
      kind: e.kind,
      amount: e.amount ?? null,
      text: e.text || "",
      createdAt: (e.createdAt || new Date()).toISOString(),
      mine: !!e.author && e.author.toString() === viewerId,
      riskFlags: e.kind === "message" ? assessMessageRisk(e.text || "") : [],
    })),
    updatedAt: (offer.updatedAt || new Date()).toISOString(),
  };
}
