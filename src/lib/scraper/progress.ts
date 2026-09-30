import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";


const PROGRESS_FILE = path.join(process.cwd(), "logs", "scrape-progress.txt");

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
