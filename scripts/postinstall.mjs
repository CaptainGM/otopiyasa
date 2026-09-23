
import { execSync } from "node:child_process";

if (process.env.VERCEL || process.env.CI || process.env.SKIP_PLAYWRIGHT === "1") {
  console.log("postinstall: Playwright indirmesi atlandı (VERCEL/CI ortamı).");
  process.exit(0);
}

try {
  execSync("npx playwright install chromium", { stdio: "inherit" });
} catch {
  console.warn(
    "postinstall: Playwright chromium indirilemedi (internet yok olabilir). " +
      "Scraper'ın tarayıcı modu gerektiğinde 'npx playwright install chromium' komutunu elle çalıştır."
  );
}
