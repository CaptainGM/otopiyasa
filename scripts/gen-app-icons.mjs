
import sharp from "sharp";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const svg = readFileSync(path.join(root, "src", "app", "icon.svg"));
const resDir = path.join(root, "mobile", "android", "app", "src", "main", "res");


const SIZES = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

for (const [folder, size] of Object.entries(SIZES)) {
  const dir = path.join(resDir, folder);
  if (!existsSync(dir)) {
    console.warn(`  atlandı (klasör yok): ${folder}`);
    continue;
  }
  const png = await sharp(svg, { density: 512 }).resize(size, size).png().toBuffer();
  writeFileSync(path.join(dir, "ic_launcher.png"), png);
  console.log(`  ${folder.padEnd(18)} ${size}x${size}  ${png.length} bayt`);
}

console.log("Android ikonları güncellendi (kaynak: src/app/icon.svg)");
