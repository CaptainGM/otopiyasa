

import { createHash, randomBytes } from "crypto";


export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function createVerifyToken() {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function hashVerifyToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}


export function isEmailVerified(user: { emailVerified?: boolean }): boolean {
  return user.emailVerified !== false;
}

export function buildVerifyUrl(appUrl: string, email: string, token: string) {
  return `${appUrl}/verify-email?email=${encodeURIComponent(email)}&token=${token}`;
}
