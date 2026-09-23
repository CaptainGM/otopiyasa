
import { Agent, setGlobalDispatcher } from "undici";
import { readFileSync } from "node:fs";
import path from "node:path";
setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));


function readEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const root = path.resolve(import.meta.dirname, "..");
    const line = readFileSync(path.join(root, ".env"), "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith(key + "="));
    return line ? line.slice(key.length + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}

const secret = readEnv("SCRAPE_RUN_SECRET");
const appUrl = readEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";
const mode = (process.env.SCRAPE_MODE || "wide").trim();

if (!secret) {
  console.error("HATA: SCRAPE_RUN_SECRET tanımlı değil.");
  process.exit(1);
}


const MODES = {
  otomerkezi: [{ source: "otomerkezi", limit: 250 }],
  quick: [
    { source: "arabam", query: "otomobil", limit: 40 },
    { source: "otomerkezi", limit: 120 },
  ],
  wide: [
    { source: "arabam", query: "otomobil", limit: 600 },
    { source: "otomerkezi", limit: 200 },
  ],
  models: [
    { mode: "rare-model", threshold: 15, perModelPages: 3, maxSegments: 250, maxListings: 700 },
  ],
};

const jobs = MODES[mode] || MODES.otomerkezi;
console.log(`Bulut tarama modu: ${mode} (${jobs.length} iş) → ${appUrl}`);

let totalNew = 0;
for (const job of jobs) {
  const label = job.source || job.mode;
  console.log(`\n[${new Date().toISOString()}] Başlıyor: ${label}`);
  try {
    const res = await fetch(`${appUrl}/api/scrape/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-scrape-secret": secret },
      body: JSON.stringify(job),
      signal: AbortSignal.timeout(5 * 60 * 60 * 1000), // 5 saat üst sınır
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      totalNew += data.inserted ?? 0;
      console.log(`Bitti: ${label} — yeni ${data.inserted ?? "?"}, güncellenen ${data.updated ?? "?"}. ${data.message ?? ""}`);
    } else {
      console.error(`HATA (${label}): HTTP ${res.status} — ${data.error ?? "bilinmeyen"}`);
    }
  } catch (err) {
    console.error(`HATA (${label}): ${err.name === "TimeoutError" ? "zaman aşımı" : err.message}`);
  }
}

console.log(`\n=== Tarama bitti. Toplam yeni ilan: ${totalNew} ===`);
