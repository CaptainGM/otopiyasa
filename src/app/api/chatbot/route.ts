import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { answerQuery, ChatContext, ChatHistoryItem } from "@/lib/chatbot";
import { checkAiRateLimit, isJunkMessage, JUNK_REPLY, ABUSE_REPLY } from "@/lib/ai-guard";
import { containsProfanity } from "@/lib/content-filter";

/**
 * Vercel'de sunucusuz fonksiyonun varsayılan süresi 10 sn. Gemini sınıflandırma
 * çağrısı ölçülen şekilde 4-7 sn sürüyor; üstüne envanter sorgusu ve soğuk
 * başlangıç eklenince 10 sn yetmiyordu ve istek platform tarafından kesiliyordu.
 * (Bkz. lib/gemini.ts TIMEOUT_MS açıklaması.)
 */
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    // Uç nokta herkese açık ve her istek Gemini kotası harcıyor → hız sınırı şart.
    const limited = await checkAiRateLimit(request, "chat");
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.slice(0, 500) : "";

    // İstemciden gelen kısa bağlam (son bahsedilen araç) — takip sorularında kullanılır
    const rawContext = body.context;
    const context: ChatContext | undefined =
      rawContext && typeof rawContext === "object"
        ? {
            carId:
              typeof rawContext.carId === "string"
                ? rawContext.carId.slice(0, 64)
                : undefined,
            brand:
              typeof rawContext.brand === "string"
                ? rawContext.brand.slice(0, 64)
                : undefined,
          }
        : undefined;

    // Sohbet geçmişi (çok turlu bağlam) — istemciden gelir, güvenli şekilde sınırla.
    // `text` uzunluğu da KIRPILIR: aksi hâlde 8 adet devasa metin gönderilip tek
    // istekte ciddi miktarda Gemini kotası yakılabilirdi (mesajın kendisi zaten
    // 500'e kırpılıyordu ama geçmiş kırpılmıyordu).
    const history: ChatHistoryItem[] = Array.isArray(body.history)
      ? body.history
          .filter(
            (h: unknown): h is ChatHistoryItem =>
              !!h &&
              typeof h === "object" &&
              (( h as ChatHistoryItem).role === "user" || (h as ChatHistoryItem).role === "bot") &&
              typeof (h as ChatHistoryItem).text === "string"
          )
          .slice(-8)
          .map((h: ChatHistoryItem) => ({ role: h.role, text: h.text.slice(0, 500) }))
      : [];

    if (!message.trim()) {
      return NextResponse.json({ error: "message zorunludur." }, { status: 400 });
    }

    // Anlamsız girdi Gemini'ye hiç gitmesin — bedava eleme.
    if (isJunkMessage(message)) {
      return NextResponse.json({ reply: JUNK_REPLY });
    }

    // Küfür/hakaret de yapay zekaya gitmez (kota harcamaz, model kışkırtılamaz).
    if (containsProfanity(message)) {
      return NextResponse.json({ reply: ABUSE_REPLY });
    }

    await connectDB();
    const result = await answerQuery(message, context, history);

    // Model çıktısı da denetlenir: geçmiş/bağlam metinleri modele girdiği için çıktı güvenilir sayılmaz.
    if (containsProfanity(result.reply)) {
      return NextResponse.json({ reply: JUNK_REPLY });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/chatbot error:", error);
    return NextResponse.json(
      { error: "Asistan şu anda yanıt veremiyor." },
      { status: 500 }
    );
  }
}
