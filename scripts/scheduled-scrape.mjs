
import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const logDir = path.join(projectRoot, "logs");
mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, "scheduled-scrape.log");

function log(message) {
  const line = `[${new Date().toLocaleString("tr-TR")}] ${message}`;
  console.log(line);
  appendFileSync(logFile, line + "\n", "utf8");
}

const env = Object.fromEntries(
  readFileSync(path.join(projectRoot, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    })
);

const secret = env.SCRAPE_RUN_SECRET;
const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
if (!secret) {
  log("HATA: .env içinde SCRAPE_RUN_SECRET tanımlı değil, çıkılıyor.");
  process.exit(1);
}


const jobs = [
  { source: "arabam", query: "otomobil", limit: 30 },
  { source: "otomerkezi", limit: 60 },
];

for (const job of jobs) {
  log(`Scrape başlıyor: ${job.source} (limit ${job.limit})`);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25 * 60 * 1000);
    const response = await fetch(`${appUrl}/api/scrape/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-scrape-secret": secret,
      },
      body: JSON.stringify(job),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      log(
        `Bitti: ${job.source} — yeni ${data.inserted ?? "?"}, güncellenen ${data.updated ?? "?"}. ${data.message ?? ""}`
      );
    } else {
      log(`HATA (${job.source}): HTTP ${response.status} — ${data.error ?? "bilinmeyen"}`);
    }
  } catch (error) {
    const reason =
      error.name === "AbortError"
        ? "zaman aşımı (25 dk)"
        : error.cause?.code === "ECONNREFUSED"
          ? "sunucu kapalı (localhost:3000 yanıt vermiyor — start.bat açık olmalı)"
          : error.message;
    log(`HATA (${job.source}): ${reason}`);
  }
}

log("Zamanlanmış scrape tamamlandı.");
