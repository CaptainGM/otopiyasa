// ============================================================================
// OtoPiyasa - Mobil sürüm yayınlama (release-apk.bat bunu çalıştırır)
// ============================================================================
// NORMALDE GEREKMEZ: main'e mobil kod gönderilince GitHub Actions (.github/workflows/mobile-release.yml) APK'yı
// derleyip sürümü kendisi yayınlar. Bu betik yalnızca GitHub Actions çalışmazsa elle yayın için.
//
// 1. mobile/pubspec.yaml'daki sürümü okur (version: 1.0.6+7 → v1.0.6, sürüm kodu 7).
// 2. APK'yı derler (build-apk.bat).
// 3. GitHub'da v1.0.6 yayınını açar ve APK'yı ekler. Yayın notuna sürüm kodu gizli yorum olarak yazılır;
//    sunucudaki /api/app-version bunu okur ve telefonlardaki "Güncellemeleri denetle" yeni sürümü görür.
//
//   node scripts/release-apk.mjs                      → notlar: önceki yayından bu yana mobil commit'leri
//   node scripts/release-apk.mjs --notlar notlar.txt  → notlar dosyadan (her satır bir madde)
//   node scripts/release-apk.mjs --derleme-yok        → var olan otopiyasa-release.apk'yı yayınlar
// Önce pubspec.yaml'daki sürümü artır (ör. 1.0.6+7 → 1.0.7+8); aynı sürüm iki kez yayınlanmaz.
// ============================================================================
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const notesArg = args.indexOf("--notlar");
const skipBuild = args.includes("--derleme-yok");

const pubspec = fs.readFileSync(path.join(root, "mobile", "pubspec.yaml"), "utf8");
const match = /^version:\s*([0-9.]+)\+(\d+)\s*$/m.exec(pubspec);
if (!match) throw new Error("mobile/pubspec.yaml içinde 'version: 1.0.6+7' biçiminde sürüm bulunamadı.");
const [, version, code] = match;
const tag = `v${version}`;

const gh = (...a) => execFileSync("gh", a, { cwd: root, encoding: "utf8" }).trim();
const tags = gh("release", "list", "--limit", "100", "--json", "tagName", "--jq", ".[].tagName").split("\n");
if (tags.includes(tag)) {
  console.error(`${tag} zaten yayınlanmış. Önce mobile/pubspec.yaml'da sürümü artır.`);
  process.exit(1);
}

let lines;
if (notesArg >= 0) {
  lines = fs.readFileSync(path.resolve(args[notesArg + 1]), "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
} else {
  const previous = tags.find(Boolean);
  const range = previous ? `${previous}..HEAD` : "HEAD~20..HEAD";
  lines = execSync(`git log ${range} --format=%s -- mobile`, { cwd: root, encoding: "utf8" })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
const body = [`<!-- versionCode: ${code} -->`, ...lines.map((l) => (l.startsWith("•") ? l : `• ${l}`))].join("\n");

const apk = path.join(root, "otopiyasa-release.apk");
if (!skipBuild) {
  console.log(`APK derleniyor (${version}, sürüm kodu ${code})...`);
  execSync(`"${path.join(root, "build-apk.bat")}"`, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, OTOPIYASA_NO_UI: "1" },
    shell: true,
  });
}
if (!fs.existsSync(apk)) throw new Error("otopiyasa-release.apk bulunamadı.");

const notesFile = path.join(os.tmpdir(), `otopiyasa-${tag}-notlar.md`);
fs.writeFileSync(notesFile, body);
gh("release", "create", tag, apk, "--title", `OtoPiyasa Mobil ${version}`, "--notes-file", notesFile, "--latest");
fs.unlinkSync(notesFile);
console.log(`${tag} yayınlandı. Telefonlar en geç ~10 dk içinde güncellemeyi görür.`);
