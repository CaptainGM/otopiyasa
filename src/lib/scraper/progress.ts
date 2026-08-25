import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";


const PROGRESS_FILE = path.join(process.cwd(), "logs", "scrape-progress.txt");

export function reportProgress(stage: string, current: number, total: number) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const line = `[${new Date().toLocaleTimeString("tr-TR")}] ${stage}: ${current}/${total} (%${pct})`;
  console.log(`  ${line}`);
  try {
    mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
    writeFileSync(PROGRESS_FILE, line, "utf8");
  } catch {
    
  }
}
