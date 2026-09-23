
const FALLBACK = "https://otopiyasa.app";


export function sanitizeBaseUrl(raw: string | undefined, fallback = FALLBACK): string {
  const cleaned = (raw || "")
    .replace(/^[﻿\s]+/, "")
    .replace(/[﻿\s]+$/, "")
    .replace(/\/+$/, "");

  if (!cleaned) return fallback;
  try {
    const url = new URL(cleaned);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    return cleaned;
  } catch {
    return fallback;
  }
}


export function appBaseUrl(): string {

  const fallback =
    process.env.NODE_ENV === "production" ? FALLBACK : "http://localhost:3000";
  return sanitizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL, fallback);
}
