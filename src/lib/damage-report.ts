

export type DamageLevel = "original" | "light" | "moderate" | "heavy" | "unknown";

export interface DamageReport {
  
  changed: number;
  
  painted: number;
 
  localPainted: number;
  
  allOriginal: boolean;
 
  unknown: boolean;
  
  affected: number;
  level: DamageLevel;
  
  summary: string;
}


function countOf(text: string, label: RegExp): number {
  const match = text.match(new RegExp(`(\\d+)\\s*${label.source}`, "i"));
  return match ? Number(match[1]) : 0;
}

export function parseDamageReport(raw: string | undefined | null): DamageReport {
  const text = (raw || "").trim();
  const lower = text.toLocaleLowerCase("tr-TR");

  const empty: DamageReport = {
    changed: 0, painted: 0, localPainted: 0,
    allOriginal: false, unknown: true, affected: 0,
    level: "unknown", summary: "Boya/değişen bilgisi belirtilmemiş.",
  };

  if (!text || lower.includes("belirtilmemiş")) return empty;

  
  if (/tamamı\s+or[ji]inal/i.test(lower)) {
    return {
      ...empty,
      unknown: false,
      allOriginal: true,
      level: "original",
      summary: "Aracın tamamı orijinal — boyalı ya da değişen parça yok.",
    };
  }

  
  if (/tamamı\s+boyalı/i.test(lower)) {
    return {
      changed: 0, painted: 0, localPainted: 0,
      allOriginal: false, unknown: false, affected: 0,
      level: "heavy",
      summary: "Aracın tamamı boyalı.",
    };
  }

  
  const localPainted = countOf(lower, /lokal\s+boyalı/);
  const withoutLocal = lower.replace(/\d+\s*lokal\s+boyalı/gi, "");
  const painted = countOf(withoutLocal, /boyalı/);
  const changed = countOf(lower, /değişen/);

  const affected = changed + painted + localPainted;
  if (affected === 0) return empty;

  
  const score = changed * 3 + painted * 2 + localPainted;
  const level: DamageLevel = score >= 12 ? "heavy" : score >= 5 ? "moderate" : "light";

  const parts: string[] = [];
  if (changed) parts.push(`${changed} değişen`);
  if (painted) parts.push(`${painted} boyalı`);
  if (localPainted) parts.push(`${localPainted} lokal boyalı`);

  return {
    changed, painted, localPainted,
    allOriginal: false, unknown: false, affected,
    level,
    summary: `${parts.join(", ")} parça bildirilmiş.`,
  };
}


export function damageLevelLabel(level: DamageLevel): string {
  switch (level) {
    case "original":
      return "Tamamı orijinal";
    case "light":
      return "Az sayıda işlem";
    case "moderate":
      return "Orta düzeyde işlem";
    case "heavy":
      return "Yoğun işlem görmüş";
    case "unknown":
      return "Bilgi yok";
  }
}
