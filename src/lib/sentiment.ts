export type SentimentLabel = "positive" | "neutral" | "negative";

export interface SentimentResult {
  score: number;
  label: SentimentLabel;
}


const POSITIVE_WORDS = [
  "harika", "mükemmel", "güzel", "iyi", "temiz", "bakımlı", "sorunsuz",
  "tavsiye", "memnun", "kaliteli", "hızlı", "konforlu", "ekonomik",
  "güvenilir", "süper", "tertemiz", "pürüzsüz", "keyifli", "başarılı",
  "rahat", "sağlam", "değer", "avantajlı", "efsane", "şahane",
];

const NEGATIVE_WORDS = [
  "kötü", "berbat", "sorunlu", "arızalı", "pişman", "pahalı", "gürültülü",
  "rahatsız", "bozuk", "kazalı", "hasarlı", "yorucu", "vasat", "yetersiz",
  "şikayet", "hayal", "kırıklığı", "titreşim", "sıkıntılı", "problemli",
  "riskli", "aldatıcı", "kalitesiz", "düşük",
];

const NEGATORS = ["değil", "yok", "hiç", "asla", "olmadı", "olmuyor"];

function tokenize(text: string): string[] {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function analyzeSentiment(text: string): SentimentResult {
  const tokens = tokenize(text);
  let score = 0;

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    const isPositive = POSITIVE_WORDS.includes(word);
    const isNegative = NEGATIVE_WORDS.includes(word);
    if (!isPositive && !isNegative) continue;

  
    const negated = NEGATORS.includes(tokens[i + 1]) || NEGATORS.includes(tokens[i + 2]);
    const polarity = isPositive ? 1 : -1;
    score += negated ? -polarity : polarity;
  }

  const label: SentimentLabel = score > 0 ? "positive" : score < 0 ? "negative" : "neutral";
  return { score, label };
}

export interface SentimentSummary {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  positivePct: number;
  negativePct: number;
}

export function summarizeSentiments(labels: SentimentLabel[]): SentimentSummary {
  const total = labels.length;
  const positive = labels.filter((l) => l === "positive").length;
  const negative = labels.filter((l) => l === "negative").length;
  const neutral = total - positive - negative;

  return {
    total,
    positive,
    neutral,
    negative,
    positivePct: total ? Math.round((positive / total) * 100) : 0,
    negativePct: total ? Math.round((negative / total) * 100) : 0,
  };
}
