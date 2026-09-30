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

async function run() {
  const { connectDB } = await import("@/lib/mongodb");
  const { Car } = await import("@/models/Car");
  await connectDB();
  const counts = await Car.aggregate([
    {
      $group: {
        _id: "$source",
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $ne: ["$status", "removed"] }, 1, 0] } },
        removed: { $sum: { $cond: [{ $eq: ["$status", "removed"] }, 1, 0] } },
      },
    },
    { $sort: { total: -1 } },
  ]);
  console.log(JSON.stringify(counts, null, 2));
  process.exit(0);
}
run();
