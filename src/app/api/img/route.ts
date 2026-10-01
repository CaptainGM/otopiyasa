import sharp from "sharp";
import { clampProxyWidth, proxyHostFor } from "@/lib/image-proxy";

export const runtime = "nodejs";

/** İndirilecek en büyük kaynak fotoğraf: bundan büyüğü işlenmez (bellek/süre koruması). */
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 12_000;

const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";

/**
 * GET /api/img?u=<fotoğraf adresi>&w=<genişlik>
 * İzinli kaynaklardaki fotoğrafı istenen genişliğe küçültüp WebP olarak verir. Yanıt değişmez kabul
 * edilip CDN'de uzun süre saklanır; kaynak/ağ hatasında kısa süreli 502 döner ve istemci özgün
 * adrese düşer.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("u") || "";
  const host = proxyHostFor(source);
  if (!host) return new Response("İzin verilmeyen kaynak", { status: 400 });
  const width = clampProxyWidth(Number(searchParams.get("w")));

  try {
    const upstream = await fetch(source, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        ...(host.referer ? { Referer: host.referer } : {}),
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) return new Response("Kaynak fotoğrafı vermedi", { status: 502, headers: { "Cache-Control": "no-store" } });
    const declared = Number(upstream.headers.get("content-length") || 0);
    if (declared > MAX_SOURCE_BYTES) return new Response("Fotoğraf çok büyük", { status: 413, headers: { "Cache-Control": "no-store" } });

    const input = Buffer.from(await upstream.arrayBuffer());
    if (input.length > MAX_SOURCE_BYTES) return new Response("Fotoğraf çok büyük", { status: 413, headers: { "Cache-Control": "no-store" } });

    const output = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 72, effort: 4 })
      .toBuffer();

    return new Response(new Uint8Array(output), {
      headers: { "Content-Type": "image/webp", "Cache-Control": IMMUTABLE, "Content-Length": String(output.length) },
    });
  } catch (error) {
    console.error("GET /api/img error:", error instanceof Error ? error.message : error);
    return new Response("Fotoğraf işlenemedi", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
