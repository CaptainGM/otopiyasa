export function formatPrice(price: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR").format(value);
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}


export function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


const TURKISH_CASE_CLASSES: Record<string, string> = {
  i: "iıİI", ı: "iıİI", İ: "iıİI", I: "iıİI",
  ş: "şŞ", Ş: "şŞ",
  ğ: "ğĞ", Ğ: "ğĞ",
  ü: "üÜ", Ü: "üÜ",
  ö: "öÖ", Ö: "öÖ",
  ç: "çÇ", Ç: "çÇ",
};


export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}


export function turkishSearchRegex(input: string): string {
  return input
    .split("")
    .map((ch) =>
      TURKISH_CASE_CLASSES[ch] ? `[${TURKISH_CASE_CLASSES[ch]}]` : escapeRegExp(ch)
    )
    .join("");
}
