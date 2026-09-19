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
    await setDaemonControl("stop", "🛑 Durduruldu (run-daemon.bat veya panelden başlatılabilir)");
    console.log("[OK] Bulut ve yerel veritabanında daemon durumu 'DURDURULDU' olarak kilitlendi.");
  } catch (err) {
    console.error("Daemon durumu guncellenemedi:", err);
  } finally {
    process.exit(0);
  }
}

main();
