
export type ChatRiskFlag = "off-platform" | "prepayment";

export const RISK_FLAG_LABEL: Record<ChatRiskFlag, string> = {
  "off-platform": "Platform dışı iletişime yönlendiriyor olabilir",
  prepayment: "Görmeden önce ödeme/kapora istiyor olabilir",
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

export function assessMessageRisk(text: string): ChatRiskFlag[] {
  const folded = foldTurkish(text || "");
  const flags: ChatRiskFlag[] = [];
  if (OFF_PLATFORM_PATTERN.test(folded)) flags.push("off-platform");
  if (PREPAYMENT_PATTERN.test(folded)) flags.push("prepayment");
  return flags;
}
