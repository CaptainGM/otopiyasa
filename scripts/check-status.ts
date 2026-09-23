import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

for (const envName of [".env", ".env.local"]) {
  const envPath = path.join(projectRoot, envName);
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
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
  const { connectDB } = await import("../src/lib/mongodb");
  const { DaemonHeartbeat } = await import("../src/models/ScrapeMetric");
  const { Car } = await import("../src/models/Car");

  await connectDB();

  const hb = await DaemonHeartbeat.findOne({ daemonId: "primary-daemon" }).lean() as any;
  const activeCount = await Car.countDocuments({ status: { $ne: "removed" } });
  const archiveCount = await Car.countDocuments({ status: "removed" });

  console.log("=== VERITABANI CANLI DURUMU ===");
  console.log("Status:", hb?.status);
  console.log("CurrentPhase:", hb?.currentPhase);
  console.log("Cycle:", hb?.cycle);
  console.log("LastHeartbeat:", hb?.lastHeartbeat);
  console.log("Aktif Ilan Sayisi:", activeCount);
  console.log("Piyasa Arsivi Sayisi:", archiveCount);
  console.log("===============================");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
