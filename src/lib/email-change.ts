import crypto from "node:crypto";


export const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;


export const MAX_CODE_ATTEMPTS = 5;


export function generateCode(): string {
  // 0-999999 aralığında kriptografik rastgele; başa sıfır eklenerek 6 haneye tamamlanır.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}


export function codeMatches(code: string, hash: string | null | undefined): boolean {
  if (!hash) return false;
  const candidate = hashCode(String(code || "").trim());
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function codeExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + EMAIL_CODE_TTL_MS);
}

export function isExpired(expiresAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  return now.getTime() > new Date(expiresAt).getTime();
}


export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 3))}@${domain}`;
}


export type EmailChangeStage = "idle" | "awaiting-current" | "awaiting-new";

export function stageOf(pending: {
  pendingEmail?: string | null;
  currentCodeHash?: string | null;
  newCodeHash?: string | null;
  codeExpires?: Date | null;
}): EmailChangeStage {
  if (!pending.pendingEmail) return "idle";
  if (isExpired(pending.codeExpires)) return "idle";
  if (pending.currentCodeHash) return "awaiting-current";
  if (pending.newCodeHash) return "awaiting-new";
  return "idle";
}
