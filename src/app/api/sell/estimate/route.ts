import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";
import { readJson } from "@/lib/http";
import { loadSellEstimate } from "@/lib/sell-estimate-data";
import { parseSellSubject, SELL_RULES } from "@/lib/sell-estimate";

export const dynamic = "force-dynamic";

/**
 * Satış formu fiyat aralığı. Fiyat gönderilmez: aralık yalnızca araç özelliklerine bağlıdır, fiyat kuralını istemci
 * `priceGuard` ile uygular (her tuşta sunucuya gitmez). Kayıt sırasında sunucu aynı kuralı yeniden uygular.
 */
export async function POST(request: Request) {
  const authUser = await getCurrentUser();
  if (!authUser) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });

  const limited = await checkSharedRateLimit(request, "sell-estimate", { limit: 240, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const body = await readJson(request);
  const parsed = parseSellSubject(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await loadSellEstimate(parsed.value);
  return NextResponse.json({
    ...result.estimate,
    damageKnown: result.damageKnown,
    warnings: result.warnings,
    thresholds: SELL_RULES,
  });
}
