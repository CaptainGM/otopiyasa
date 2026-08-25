
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const appDir = path.join(root, "src", "app");
const svg = readFileSync(path.join(appDir, "icon.svg"));


async function png(size, outName) {
  const buf = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
  writeFileSync(path.join(appDir, outName), buf);
  console.log(`  ${outName.padEnd(16)} ${size}x${size}  ${buf.length} bayt`);
  return buf;
}


function pngToIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // ayrılmış
  header.writeUInt16LE(1, 2); // tip: 1 = ikon
  header.writeUInt16LE(1, 4); // görüntü sayısı

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // genişlik
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // yükseklik
  entry.writeUInt8(0, 2); // palet rengi yok
  entry.writeUInt8(0, 3); // ayrılmış
  entry.writeUInt16LE(1, 4); // renk düzlemi
  entry.writeUInt16LE(32, 6); // piksel başına bit
  entry.writeUInt32LE(pngBuffer.length, 8); // veri boyutu
  entry.writeUInt32LE(header.length + entry.length, 12); // veri konumu

  return Buffer.concat([header, entry, pngBuffer]);
}

console.log("İkonlar üretiliyor (kaynak: src/app/icon.svg)");
const icoSource = await png(64, "icon.png");
await png(180, "apple-icon.png");

const ico = pngToIco(icoSource, 64);
writeFileSync(path.join(appDir, "favicon.ico"), ico);
console.log(`  favicon.ico      64x64    ${ico.length} bayt`);
console.log("Bitti. Next.js src/app altındaki bu dosyaları otomatik sunar.");
