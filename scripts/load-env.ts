import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * .env / .env.local dosyalarını process.env'e yükler (zaten tanımlı olanları ezmez).
 * Betikler uygulama modüllerini import etmeden ÖNCE çağırmalıdır: mongodb.ts ve
 * rate-limit.ts ortam değişkenlerini import anında okur.
 *
 * Eski betiklerdeki elle ayrıştırma tırnakları temizlemiyordu:
 * MONGODB_URI="mongodb+srv://..." satırı tırnaklarıyla birlikte okunuyordu.
 */
export function loadEnv(projectRoot = process.cwd()) {
  for (const name of [".env", ".env.local"]) {
    const file = path.join(projectRoot, name);
    if (!existsSync(file)) continue;
    for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  }
}
