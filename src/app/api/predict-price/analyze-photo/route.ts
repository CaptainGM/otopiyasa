import { NextResponse } from "next/server";
import { analyzeCarPhoto, isGeminiConfigured, CarPhotoInput } from "@/lib/gemini";
import { checkAiRateLimit } from "@/lib/ai-guard";

/**
 * Toplam base64 uzunluk sınırı (~3 MB ham görsel) ve en fazla görsel sayısı.
 *
 * Eskiden 14.000.000 karakter (~10 MB) idi; bu hem gereksizdi hem de yanıltıcı:
 * Vercel'in sunucusuz istek gövdesi sınırı zaten 4,5 MB, yani o kadar büyük bir
 * istek uç noktaya hiç ulaşamıyordu. Tarayıcı tarafı fotoğrafları 1024 px'e
 * küçültüp gönderiyor (~150-250 KB/foto), dolayısıyla 6 fotoğraf bu sınırın
 * çok altında kalır. Dar sınır aynı zamanda kota yakma girişimini de kısar.
 */
const MAX_TOTAL_BASE64_LEN = 4_200_000;
const MAX_IMAGES = 6;

/** Vision çağrısı en uzun süren AI işi; Vercel'in 10 sn varsayılanı yetmiyor. */
export const maxDuration = 40;

export async function POST(request: Request) {
  try {
    // En pahalı AI çağrısı (Vision) — en dar hız sınırı.
    const limited = checkAiRateLimit(request, "photo");
    if (limited) return limited;

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: "Görsel analizi şu an kullanılamıyor (AI yapılandırılmamış)." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    // Çoklu görsel: body.images = [{ image, mimeType }]. Tek görsel geriye dönük
    // uyumluluk için body.image de kabul edilir.
    const rawImages: unknown[] = Array.isArray(body.images)
      ? body.images
      : body.image
        ? [{ image: body.image, mimeType: body.mimeType }]
        : [];

    const images: CarPhotoInput[] = rawImages
      .slice(0, MAX_IMAGES)
      .map((it) => {
        const o = it as Record<string, unknown>;
        const data = typeof o.image === "string" ? o.image : "";
        const mt =
          typeof o.mimeType === "string" && o.mimeType.startsWith("image/")
            ? o.mimeType
            : "image/jpeg";
        return { data, mimeType: mt };
      })
      .filter((i) => i.data);

    if (images.length === 0) {
      return NextResponse.json({ error: "En az bir görsel gerekli." }, { status: 400 });
    }
    const totalLen = images.reduce((s, i) => s + i.data.length, 0);
    if (totalLen > MAX_TOTAL_BASE64_LEN) {
      return NextResponse.json({ error: "Görseller çok büyük." }, { status: 413 });
    }

    const analysis = await analyzeCarPhoto(images);
    if (!analysis) {
      return NextResponse.json(
        { error: "Fotoğraf analiz edilemedi. Daha net bir araç fotoğrafı deneyin." },
        { status: 502 }
      );
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("POST /api/predict-price/analyze-photo error:", error);
    return NextResponse.json({ error: "Görsel analizi başarısız oldu." }, { status: 500 });
  }
}
