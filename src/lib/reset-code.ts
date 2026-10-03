import { MAX_CODE_ATTEMPTS, codeMatches, isExpired } from "@/lib/email-change";

/**
 * Mobil uygulamada şifre sıfırlama: web'deki gibi bağlantı yerine e-postaya 6 haneli kod gider.
 * Kod kısa olduğu için deneme sayısı sınırlıdır (5 yanlıştan sonra kod yanar).
 */
export type ResetCodeResult = "ok" | "expired" | "locked" | "wrong";

export function checkResetCode(
  user: { resetCodeHash?: string | null; resetCodeExpires?: Date | null; resetCodeAttempts?: number | null },
  code: string,
  now: Date = new Date()
): ResetCodeResult {
  if (!user.resetCodeHash || isExpired(user.resetCodeExpires, now)) return "expired";
  if ((user.resetCodeAttempts || 0) >= MAX_CODE_ATTEMPTS) return "locked";
  return codeMatches(code, user.resetCodeHash) ? "ok" : "wrong";
}

/** Yanlış denemeden sonra kaç hak kaldığı. */
export function attemptsLeft(attemptsAfterFailure: number): number {
  return Math.max(0, MAX_CODE_ATTEMPTS - attemptsAfterFailure);
}
