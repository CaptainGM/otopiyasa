import { isPresetRequest, renderPresetPng } from "@/lib/avatar-render";

// Bilerek revalidate/dynamic dışa aktarımı yok: adres değişmez (stil + 0-999 tohum), CDN ve tarayıcı bir kez çizilmiş PNG'yi yıllarca saklar.

/** Hazır profil avatarı (PNG). Yalnızca tanımlı stil ve 0-999 tohum kabul edilir; sınırlı uzay, CDN'de değişmez önbellek. */
export async function GET(_request: Request, { params }: { params: Promise<{ style: string; seed: string }> }) {
  const { style, seed } = await params;
  const request = isPresetRequest(style, seed);
  if (!request) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });

  const png = await renderPresetPng(request.style, request.seed);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
