// Marka resmi Türkiye sitelerindeki teknik özellik sayfalarını okur, src/lib/catalog/official-specs-data.ts dosyasını üretir.
// robots.txt'e uygun (genel tarayıcıya açık yollar), istekler arası 4-5 sn insansi aralık.
//   npx tsx scripts/official-specs.ts
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as cheerio from "cheerio";
import { fuelClassOf, type OfficialSpecEntry } from "../src/lib/catalog/official-specs";

const UA = "OtoPiyasaBot/1.0 (+https://otopiyasa.app)";
const today = new Date().toISOString().slice(0, 10);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Ondalıklı alanlar (hızlanma sn, dönüş çapı m): virgül ondalık ayracı noktaya çevrilir ("9,9" → 9.9, "10.86" aynen kalır). */
function numberOf(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return cleaned ? Number(cleaned[0]) : undefined;
}

/**
 * Tam sayı alanları (ağırlık, tork, hız, bagaj, depo litresi): bu sitede bazı sayfalar dört haneli sayıyı
 * nokta BİNLİK ayracıyla yazıyor ("1.434" = 1434 kg, Boreal sayfasında görüldü), diğerleri ayraçsız ("1654").
 * Bu alanlarda hiçbir zaman ondalık beklenmez; nokta her zaman silinir.
 */
function integerOf(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\./g, "").match(/-?\d+/);
  return digits ? Number(digits[0]) : undefined;
}

// --- RENAULT: binek-araclar / hybrid-araclar / elektrikli-araclar / ticari-araclar altındaki teknik-bilgiler.html ---
// Yapı: <div class="AlternativeVersionComparatorBody__row"><dl><dt class="...__itemKey">LABEL</dt><dd class="...__itemValue">VALUE</dd></dl></div>
// Sayfa başına tek motor seçeneği (doğrulandı: Austral, Duster).
const RENAULT_PAGES: Array<{ url: string; modelFamily: string }> = [
  { url: "https://www.renault.com.tr/binek-araclar/megane-sedan/teknik-bilgiler.html", modelFamily: "Megane" },
  { url: "https://www.renault.com.tr/elektrikli-araclar/megane-e-tech-elektrikli/teknik-bilgiler.html", modelFamily: "Megane" },
  { url: "https://www.renault.com.tr/elektrikli-araclar/r5-e-tech-elektrikli/teknik-bilgiler.html", modelFamily: "5" },
  { url: "https://www.renault.com.tr/elektrikli-araclar/scenic-e-tech-elektrikli/teknik-bilgiler.html", modelFamily: "Scenic" },
  { url: "https://www.renault.com.tr/hybrid-araclar/boreal/teknik-bilgiler.html", modelFamily: "Boreal" },
  { url: "https://www.renault.com.tr/hybrid-araclar/captur-e-tech/teknik-bilgiler.html", modelFamily: "Captur" },
  { url: "https://www.renault.com.tr/hybrid-araclar/rafale/teknik-bilgiler.html", modelFamily: "Rafale" },
  { url: "https://www.renault.com.tr/hybrid-araclar/renault-austral-2025/teknik-bilgiler.html", modelFamily: "Austral" },
  { url: "https://www.renault.com.tr/hybrid-araclar/yeni-clio/teknik-bilgiler.html", modelFamily: "Clio" },
  { url: "https://www.renault.com.tr/hybrid-araclar/yeni-renault-duster/teknik-bilgiler.html", modelFamily: "Duster" },
  { url: "https://www.renault.com.tr/ticari-araclar/master-panelvan/teknik-bilgiler.html", modelFamily: "Master" },
];

function parseRenault(html: string, url: string, modelFamily: string): OfficialSpecEntry | null {
  const $ = cheerio.load(html);
  const pairs: Array<[string, string]> = [];
  $(".AlternativeVersionComparatorBody__row").each((_, el) => {
    const key = $(el).find(".AlternativeVersionComparatorBody__itemKey").first().text().trim();
    const value = $(el).find(".AlternativeVersionComparatorBody__itemValue").first().text().trim();
    if (key) pairs.push([key, value]);
  });
  if (pairs.length === 0) return null;

  const find = (pred: (k: string) => boolean) => pairs.find(([k]) => pred(k.toLowerCase()))?.[1];
  const engineLabel = find((k) => k === "motor") || "";
  const fuelRaw = find((k) => k.includes("yakıt tipi")) || find((k) => k.includes("motor tipi")) || "";
  const hpFromEngine = Number(/(\d+)\s*hp/i.exec(engineLabel)?.[1] || "");
  const powerRaw = find((k) => k.includes("maksimum güç")) || "";
  const powerNums = (powerRaw.match(/\d+/g) || []).map(Number);
  const hp = hpFromEngine || powerNums[powerNums.length - 1];
  if (!hp) return null;

  return {
    brand: "Renault",
    modelFamily,
    horsepower: hp,
    fuelClass: fuelClassOf(fuelRaw),
    engineLabel,
    acceleration: numberOf(find((k) => k.includes("hızlanma") && k.trim().startsWith("0"))),
    topSpeed: integerOf(find((k) => k.includes("maksimum hız"))),
    torque: integerOf(find((k) => k.startsWith("tork"))),
    trunkCapacity: integerOf(find((k) => k.includes("bagaj hacmi") && !k.includes("azami"))),
    fuelTank: (() => {
      const l = integerOf(find((k) => k.includes("yakıt deposu kapasitesi")));
      return l ? `${l} L` : undefined;
    })(),
    curbWeight: integerOf(find((k) => k.includes("boş ağırlık"))),
    sourceUrl: url,
    fetchedAt: today,
  };
}

// --- SEAT: modeller/{model}/teknik-ozellikler/{trim} ---
// İki farklı şablon gözlendi:
//  A) Leon/Ateca: <div class="seat-model-engine" data-engine-name="1.0 eTSI 110 HP DSG"> içinde .w-data > h5 + .bignumber + .bigdata
//  B) Ibiza/Arona: .cmp-specs-engine-data-item > __label + __value-odometer + __value-unit; yakıt .cmp-specs-engine-data__title .cmp-title__text
const SEAT_PAGES: Array<{ url: string; modelFamily: string }> = [
  { url: "https://www.seat.com.tr/modeller/ibiza/teknik-ozellikler/style", modelFamily: "Ibiza" },
  { url: "https://www.seat.com.tr/modeller/ibiza/teknik-ozellikler/fr", modelFamily: "Ibiza" },
  { url: "https://www.seat.com.tr/modeller/arona/teknik-ozellikler/style", modelFamily: "Arona" },
  { url: "https://www.seat.com.tr/modeller/arona/teknik-ozellikler/fr", modelFamily: "Arona" },
  { url: "https://www.seat.com.tr/modeller/leon/teknik-ozellikler/style", modelFamily: "Leon" },
  { url: "https://www.seat.com.tr/modeller/leon/teknik-ozellikler/fr", modelFamily: "Leon" },
  { url: "https://www.seat.com.tr/modeller/ateca/teknik-ozellikler/style", modelFamily: "Ateca" },
  { url: "https://www.seat.com.tr/modeller/ateca/teknik-ozellikler/fr", modelFamily: "Ateca" },
];

function parseSeat(html: string, url: string, modelFamily: string): OfficialSpecEntry | null {
  const $ = cheerio.load(html);

  // Şablon A: data-engine-name niteliği olan motor kartı.
  const engineCard = $(".seat-model-engine").first();
  if (engineCard.length > 0) {
    const engineLabel = engineCard.attr("data-engine-name") || "";
    const hp = Number(/(\d+)\s*hp/i.exec(engineLabel)?.[1] || "");
    if (!hp) return null;
    const valueFor = (labelPred: (l: string) => boolean, parse: (s: string) => number | undefined): number | undefined => {
      let found: number | undefined;
      engineCard.find(".w-data").each((_, el) => {
        const label = $(el).find("h5").first().text().trim().toLowerCase();
        if (labelPred(label)) found = parse($(el).find(".bignumber").first().text().trim());
      });
      return found;
    };
    return {
      brand: "Seat",
      modelFamily,
      horsepower: hp,
      fuelClass: fuelClassOf(engineLabel),
      engineLabel,
      acceleration: valueFor((l) => l.includes("hızlanma") && l.includes("100"), numberOf),
      topSpeed: valueFor((l) => l.includes("hız") && !l.includes("hızlanma"), integerOf),
      torque: valueFor((l) => l.includes("tork"), integerOf),
      // Bagaj/depo/ağırlık bu şablonda doğrulanmadı: yanlış alan okumaktansa boş bırakılır.
      sourceUrl: url,
      fetchedAt: today,
    };
  }

  // Şablon B: cmp-specs-engine-data-item listesi (ham metin saklanır, alana göre ondalık/tam sayı ayrımı aşağıda yapılır).
  const items: Array<[string, string]> = [];
  $(".cmp-specs-engine-data-item").each((_, el) => {
    const label = $(el).find(".cmp-specs-engine-data-item__label").first().text().trim().toLowerCase();
    const raw = $(el).find(".cmp-specs-engine-data-item__value-odometer").first().text().trim();
    if (label) items.push([label, raw]);
  });
  if (items.length === 0) return null;

  const fuelRaw = $(".cmp-specs-engine-data__title .cmp-title__text").first().text().trim();
  const engineLabel = $(".cmp-specs-engine-data__text .cmp-text p").first().text().trim();
  const hp = Number(/\((\d+)\s*PS\)/i.exec(engineLabel)?.[1] || "");
  if (!hp) return null;
  const find = (pred: (l: string) => boolean) => items.find(([l]) => pred(l))?.[1];

  return {
    brand: "Seat",
    modelFamily,
    horsepower: hp,
    fuelClass: fuelClassOf(fuelRaw),
    engineLabel,
    acceleration: numberOf(find((l) => l.includes("0-100"))),
    topSpeed: integerOf(find((l) => l.includes("maks") && l.includes("hız"))),
    torque: integerOf(find((l) => l.includes("tork"))),
    trunkCapacity: integerOf(find((l) => l.includes("bagaj"))),
    sourceUrl: url,
    fetchedAt: today,
  };
}

async function main() {
  const entries: OfficialSpecEntry[] = [];
  const failures: string[] = [];

  for (const { url, modelFamily } of RENAULT_PAGES) {
    try {
      const html = await fetchHtml(url);
      const entry = parseRenault(html, url, modelFamily);
      if (entry) {
        entries.push(entry);
        console.log(`✓ Renault ${modelFamily}: ${entry.horsepower} hp (${entry.engineLabel})`);
      } else {
        failures.push(url);
        console.log(`✗ Renault ${modelFamily}: beklenen alanlar bulunamadı (${url})`);
      }
    } catch (error) {
      failures.push(url);
      console.log(`✗ Renault ${modelFamily}: ${(error as Error).message} (${url})`);
    }
    await sleep(4000 + Math.random() * 1000);
  }

  for (const { url, modelFamily } of SEAT_PAGES) {
    try {
      const html = await fetchHtml(url);
      const entry = parseSeat(html, url, modelFamily);
      if (entry) {
        entries.push(entry);
        console.log(`✓ Seat ${modelFamily}: ${entry.horsepower} hp (${entry.engineLabel})`);
      } else {
        failures.push(url);
        console.log(`✗ Seat ${modelFamily}: beklenen alanlar bulunamadı (${url})`);
      }
    } catch (error) {
      failures.push(url);
      console.log(`✗ Seat ${modelFamily}: ${(error as Error).message} (${url})`);
    }
    await sleep(4000 + Math.random() * 1000);
  }

  // Aynı marka+model+hp+yakıt için birden fazla sayfa eşleştiyse (ör. iki trim aynı motoru paylaşıyorsa) ilkini tut.
  const seen = new Set<string>();
  const deduped = entries.filter((e) => {
    const key = `${e.brand}|${e.modelFamily}|${e.horsepower}|${e.fuelClass}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const file = resolve(import.meta.dirname, "..", "src/lib/catalog/official-specs-data.ts");
  const body =
    `// OTOMATİK ÜRETİLDİ: npx tsx scripts/official-specs.ts (bkz. scripts/model-catalog.ts ile aynı desen). Elle düzenlenmez.\n` +
    `import type { OfficialSpecEntry } from "./official-specs";\n\n` +
    `export const OFFICIAL_SPECS: OfficialSpecEntry[] = ${JSON.stringify(deduped, null, 2)};\n`;
  writeFileSync(file, body, "utf8");

  console.log(`\n${deduped.length} doğrulanmış motor varyantı yazıldı (${entries.length - deduped.length} yinelenen elendi, ${failures.length} sayfa başarısız).`);
  if (failures.length > 0) console.log("Başarısız sayfalar:", failures.join(", "));
}

main().catch((err) => {
  console.error("official-specs hatası:", err);
  process.exit(1);
});
