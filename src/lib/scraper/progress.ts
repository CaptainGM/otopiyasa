import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";


const PROGRESS_FILE = path.join(process.cwd(), "logs", "scrape-progress.txt");

const EVENT_FILE = path.join(process.cwd(), "logs", "scrape-olaylar.jsonl");

/**
 * Terminale (scrape.bat) giden okunur özet: bir birim (model, marka...) bitince tek satır. İlerleme sayacı
 * (reportProgress) her ilanda çalışır ve sunucu günlüğünü doldurur; bu ise sonuçtur: "Ferrari F8: 17 → 18 ilan (+1)".
 * scrape.mjs bu dosyayı izleyip biçimlendirir.
 */
export function reportEvent(event: { label: string; before?: number; after?: number; added: number }) {
  try {
    mkdirSync(path.dirname(EVENT_FILE), { recursive: true });
    appendFileSync(EVENT_FILE, JSON.stringify({ t: Date.now(), ...event }) + "\n", "utf8");
  } catch {
    // olay yazılamazsa tarama etkilenmez
  }
}

let progressHook: ((stage: string, current: number, total: number) => void) | null = null;

export function setProgressHook(fn: ((stage: string, current: number, total: number) => void) | null) {
  progressHook = fn;
}

export function reportProgress(stage: string, current: number, total: number) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const line = `[${new Date().toLocaleTimeString("tr-TR")}] ${stage}: ${current}/${total} (%${pct})`;
  console.log(`  ${line}`);

  if (progressHook) {
    try {
      progressHook(stage, current, total);
    } catch {}
  }

  try {
    mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
    writeFileSync(PROGRESS_FILE, line, "utf8");
  } catch {
    
  }
}
