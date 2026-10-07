// ============================================================================
// Elle tarama sırasında Arabam bekçisini duraklatır
// ============================================================================
// Elle çalıştırılan Arabam taramaları (scrape.bat: turbo, kategori, doğrulama, galeri...) ile bekçi aynı ev
// internetinden Arabam'a gider; ikisi birlikte Cloudflare'a çift hızla istek atar ve engel yeme riski artar.
// Bu yüzden elle tarama başlayınca logs/arabam-elle.pause dosyası yazılır, bekçi her turun başında buna bakar ve
// tarama bitene kadar bekler. Tarama bitince (normal çıkış, Ctrl+C, hata, pencerenin kapatılması) dosya kalkar;
// süreç sert öldürülse bile dosyadaki süreç numarası artık yaşamadığı için bekçi kendiliğinden devam eder.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAUSE_FILE = path.join(root, "logs", "arabam-elle.pause");
/** Unutulmuş dosya bekçiyi sonsuza dek durdurmasın (süreç numarası başka bir programa geçmiş olabilir). */
const MAX_HOLD_MS = 12 * 60 * 60 * 1000;

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === "EPERM";
  }
}

/** Bu süreç bitene kadar bekçiyi duraklatır. `label` bekçinin ekranda göstereceği ad. */
export function pauseWatcher(label) {
  try {
    fs.mkdirSync(path.dirname(PAUSE_FILE), { recursive: true });
    fs.writeFileSync(PAUSE_FILE, JSON.stringify({ pid: process.pid, label, startedAt: new Date().toISOString() }));
    process.on("exit", () => {
      try {
        const current = JSON.parse(fs.readFileSync(PAUSE_FILE, "utf8"));
        if (current.pid === process.pid) fs.unlinkSync(PAUSE_FILE);
      } catch {
        // dosya zaten yok
      }
    });
    console.log(`  ⏸  Arabam bekçisi bu tarama bitene kadar bekletiliyor (${label}).`);
  } catch {
    // Duraklatma yazılamazsa tarama yine çalışır; yalnızca çakışma uyarısı kaybolur.
  }
}

/** Bekçi için: elle tarama sürüyorsa adını, yoksa null döner. */
export function manualScrapeHold() {
  try {
    const hold = JSON.parse(fs.readFileSync(PAUSE_FILE, "utf8"));
    const age = Date.now() - new Date(hold.startedAt).getTime();
    if (!hold.pid || !alive(hold.pid) || age > MAX_HOLD_MS) {
      fs.unlinkSync(PAUSE_FILE);
      return null;
    }
    return String(hold.label || "elle tarama");
  } catch {
    return null;
  }
}
