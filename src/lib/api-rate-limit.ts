import { NextResponse } from "next/server";

/**
 * IP + bucket bazlı istek hız sınırlayıcı.
 *
 * BİLİNEN KISIT: Vercel serverless ortamında her instance kendi process'inde
 * çalışır, bu Map instance'lar arasında paylaşılmaz. Yoğun trafikte birden
 * fazla instance ayağa kalkarsa bir saldırgan her instance'a ayrı ayrı istek
 * atabilir. Düşük-orta trafikte Vercel çoğunlukla tek instance kullanır, bu
 * nedenle mevcut proje ölçeğinde koruma yeterlidir.
 *
 * TODO: Gelecekte Upstash Redis (ücretsiz katman) veya Vercel KV entegrasyonu
 * ile dağıtık rate limiting yapılabilir. Bkz:
 *   - https://upstash.com/docs/oss/sdks/ts/ratelimit/overview
 *   - @upstash/ratelimit paketi
 */
const attempts = new Map<string, { count: number; resetAt: number }>();


const MAX_TRACKED = 5000;


function clientIp(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "local";
}


function sweep(now: number) {
  if (attempts.size < MAX_TRACKED) return;
  for (const [key, entry] of attempts) {
    if (now > entry.resetAt) attempts.delete(key);
  }
  while (attempts.size >= MAX_TRACKED) {
    const oldest = attempts.keys().next().value;
    if (oldest === undefined) break;
    attempts.delete(oldest);
  }
}


export function checkRateLimit(
  request: Request,
  bucket: string,
  options: { limit?: number; windowMs?: number } = {}
): NextResponse | null {
  const limit = options.limit ?? 10;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const key = `${bucket}:${clientIp(request)}`;
  const now = Date.now();

  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    sweep(now);
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count += 1;
  if (entry.count > limit) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      {
        error: `Çok fazla deneme yapıldı. Lütfen ${Math.ceil(retryAfterSec / 60)} dakika sonra tekrar deneyin.`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  return null;
}
