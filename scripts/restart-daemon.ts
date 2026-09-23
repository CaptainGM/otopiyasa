import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

for (const envName of [".env", ".env.local"]) {
  const envPath = path.join(projectRoot, envName);
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  try {
    const { connectDB } = await import("../src/lib/mongodb");
    const { setDaemonControl } = await import("../src/models/ScrapeMetric");

    await connectDB();
    await setDaemonControl("restart", "🔄 Yeniden Başlatılıyor (GitHub'dan Taze Kod Çekiliyor)...");
    console.log("====================================================================");
    console.log("  [OK] Otonom Scraper Motoruna 'YENİDEN BAŞLAT' komutu gönderildi!");
    console.log("  - Sunucu GitHub'dan en güncel kodu çekerek kendini tazeleyecek.");
    console.log("====================================================================");
  } catch (err) {
    console.error("Yeniden başlatma komutu gönderilemedi:", err);
  } finally {
    process.exit(0);
  }
}

main();
