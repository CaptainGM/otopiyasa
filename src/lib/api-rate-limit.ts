import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { ApiRateLimit } from "@/models/ApiRateLimit";

function clientIp(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "local";
}

function tooManyRequests(resetAt: Date) {
  const retryAfterSec = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
  return NextResponse.json(
    { error: `Çok fazla deneme yapıldı. Lütfen ${Math.ceil(retryAfterSec / 60)} dakika sonra tekrar deneyin.` },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

/** Shared, atomic IP + bucket rate limiting backed by MongoDB. */
export async function checkSharedRateLimit(
  request: Request,
  bucket: string,
  options: { limit?: number; windowMs?: number } = {}
): Promise<NextResponse | null> {
  const limit = options.limit ?? 10;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const ipHash = createHash("sha256").update(clientIp(request)).digest("hex");
  const key = `${bucket}:${ipHash}`;
  const now = new Date();

  const { connectDB } = await import("@/lib/mongodb");
  await connectDB();

  const incrementActive = () =>
    ApiRateLimit.findOneAndUpdate(
      { key, resetAt: { $gt: now } },
      { $inc: { count: 1 } },
      { new: true }
    ).lean<{ count: number; resetAt: Date }>();

  let record = await incrementActive();
  if (!record) {
    const resetAt = new Date(now.getTime() + windowMs);
    try {
      record = await ApiRateLimit.findOneAndUpdate(
        { key, resetAt: { $lte: now } },
        { $set: { count: 1, resetAt, expiresAt: new Date(resetAt.getTime() + 60 * 60 * 1000) } },
        { new: true, upsert: true }
      ).lean<{ count: number; resetAt: Date }>();
    } catch (error) {
      // Concurrent first requests can race to upsert the same key. The unique
      // index picks one; the loser increments that newly created active window.
      if ((error as { code?: number }).code !== 11000) throw error;
      record = await incrementActive();
      if (!record) throw error;
    }
  }

  if (!record) throw new Error("Rate limit kaydı oluşturulamadı.");
  return record.count > limit ? tooManyRequests(record.resetAt) : null;
}

// Kept for isolated deterministic consumers that do not execute server routes.
const localAttempts = new Map<string, { count: number; resetAt: number }>();
export function checkRateLimit(
  request: Request,
  bucket: string,
  options: { limit?: number; windowMs?: number } = {}
): NextResponse | null {
  const limit = options.limit ?? 10;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const key = `${bucket}:${clientIp(request)}`;
  const now = Date.now();
  const entry = localAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    localAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  entry.count += 1;
  return entry.count > limit ? tooManyRequests(new Date(entry.resetAt)) : null;
}
