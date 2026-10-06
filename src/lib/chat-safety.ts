export type ChatRiskFlag = "off-platform" | "prepayment" | "payment-info" | "external-link";

export const RISK_FLAG_LABEL: Record<ChatRiskFlag, string> = {
  "off-platform": "Platform dışı iletişime yönlendiriyor olabilir",
  prepayment: "Görmeden önce ödeme/kapora istiyor olabilir",
  "payment-info": "Hesap/IBAN ya da havale bilgisi paylaşıyor olabilir; aracı görmeden ödeme yapma",
  "external-link": "Harici bir siteye yönlendiriyor olabilir; bağlantıya tıklama, kart/hesap bilgisi girme",
};

function foldTurkish(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
}

const OFF_PLATFORM_PATTERN =
  /(whatsapp|telegram|instagram|\binsta\b|facebook|snapchat|\bsignal\b|\bviber\b|\bwp['’]?(dan|den|tan|ten)\b)/;

const PREPAYMENT_PATTERN = /(kapora|kaparo|pesinat|on\s*odeme)/;

// IBAN (TR + 24 hane, boşluklu da olabilir), havale/EFT, Papara, "hesap numarası" gibi ödeme bilgisi kalıpları.
const PAYMENT_INFO_PATTERN =
  /(\biban\b|\btr\s?\d{2}(?:\s?\d){10,}|\bhavale\b|\beft\b|papara|western\s*union|\bswift\b|hesap\s*(no|numara)|banka\s*hesab|ininal)/;

// Bağlantı: http(s)://, www. ya da alan adı uzantısı (ör. "guvenli-odeme.xyz").
const EXTERNAL_LINK_PATTERN =
  /(https?:\/\/|\bwww\.|\b[a-z0-9][a-z0-9-]*\.(com|net|org|info|xyz|link|site|online|shop|store|click|top|me|co|app|ly|biz|cc|tk)(\/|\b))/;

export function assessMessageRisk(text: string): ChatRiskFlag[] {
  const folded = foldTurkish(text || "");
  const flags: ChatRiskFlag[] = [];
  if (OFF_PLATFORM_PATTERN.test(folded)) flags.push("off-platform");
  if (PREPAYMENT_PATTERN.test(folded)) flags.push("prepayment");
  if (PAYMENT_INFO_PATTERN.test(folded)) flags.push("payment-info");
  if (EXTERNAL_LINK_PATTERN.test(folded)) flags.push("external-link");
  return flags;
}
