import { Car } from "@/models/Car";
import { parseConsumption } from "@/lib/fuel-cost";
import { normalizeFuelType } from "@/lib/normalize-fuel";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";

/**
 * EMSAL TÜKETİM TAMAMLAMA.
 *
 * Kaynakların bir kısmı ilan sayfasında "Ort. Yakıt Tüketimi" alanını yayınlıyor (Arabam, DOD,
 * Carvak), bir kısmı hiç yayınlamıyor (Otokoç, Otomerkezi, Otoplus, VavaCars). Sonuç: 42 bin aktif
 * ilanın yalnızca yarısında kaynak tüketim değeri var; kalanı için yakıt maliyeti kartı model/sınıf
 * tahminine düşüyor (bkz. fuel-cost.ts estimateConsumption).
 *
 * Ama aynı aracın (marka + model ailesi + motor hacmi + yakıt) kaynak tüketim değeri BAŞKA ilanlarda zaten
 * duruyor: ör. "Chery Tiggo 7 Pro 1.6 Benzin" ilanlarının bir kısmında 8,6 lt yazıyor, aynı aracın
 * tüketimi boş olan ilanlarında hiçbir şey yazmıyordu. Bu modül o boşluğu, aynı grubun kaynakta yayımlanan
 * değerlerinin medyanıyla tamamlar. Bu değer hedef ilanın katalog değeri değildir.
 *
 * Hedef ilan için emsal değeridir; kartta kaynağı ve medyan olduğu açıkça belirtilir.
 */

/** Bir grupta medyan hesaplanabilmesi için gereken en az kaynak tüketim değeri sayısı. */
export const MIN_GROUP_SAMPLES = 5;

export interface ConsumptionBackfillResult {
  /** Değeri boş olan ve incelenen grup sayısı. */
  groups: number;
  /** Güncellenen ilan sayısı. */
  updated: number;
  /** Değer yazılan farklı (marka, model, motor, yakıt) kombinasyonu. */
  filled: number;
  /** Kapsamdaki (tüketimi boş) toplam ilan sayısı — kapsam ölçüsü. */
  candidates: number;
  /** Doldurulabilir gruplardaki ilan sayısı (deneme modunda da hesaplanır). */
  fillable: number;
}

interface GroupRow {
  _id: { brand: string; model: string; engine: number; fuel: string };
  count: number;
}

/** Motor hacmini ilan metinlerindeki yazımlarla eşleştiren desen ("1.6" → "1.6" | "1,6" | "1600"). */
export function enginePattern(engine: number): RegExp {
  const fixed = engine.toFixed(1);
  const digits = fixed.replace(".", "");
  const loose = fixed.replace(".", "[.,]");
  return new RegExp(`(?:^|[^\\d.,])(?:${loose}|${digits})(?![\\d.,]\\d)`, "i");
}

/**
 * Tüketimi boş olan ilanları gruplar. Yalnızca motor hacmi bilinen ilanlar adaydır: motor
 * bilinmiyorsa gruptaki değer çok farklı araçları kapsar (1.0 ile 2.0 aynı tüketmez).
 */
async function loadMissingGroups(limit: number): Promise<GroupRow[]> {
  return Car.aggregate<GroupRow>([
    {
      $match: {
        ...PUBLIC_LISTING_FILTER,
        "features.engineSize": { $gt: 0 },
        $or: [
          { "features.avgFuelConsumption": "" },
          { "features.avgFuelConsumption": null },
          { "features.avgFuelConsumption": { $exists: false } },
        ],
      },
    },
    {
      $group: {
        _id: { brand: "$brand", model: "$model", engine: "$features.engineSize", fuel: "$features.fuelType" },
        count: { $sum: 1 },
      },
    },
    { $match: { "_id.brand": { $nin: ["", null] }, "_id.model": { $nin: ["", null] }, "_id.fuel": { $nin: ["", null] } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
}

/**
 * İlanında tüketim bulunmayan kayıtlara aynı model grubunun kaynak tüketim medyanını ekler.
 * Bu, hedef ilanın resmî/katalog değeri değildir; yalnızca kaynakta değer yayımlanmış emsal ilanlardan türetilir.
 *
 * @param options.limit        Tek çalıştırmada işlenecek en fazla grup sayısı (sorgu yükünü sınırlar).
 * @param options.dryRun       true ise hiçbir şey yazılmaz, yalnızca ne yapılacağı raporlanır.
 * @param options.minSamples   Bir grup için gereken en az resmî değer sayısı.
 */
export async function backfillConsumption(
  options: { limit?: number; dryRun?: boolean; minSamples?: number; log?: (msg: string) => void } = {}
): Promise<ConsumptionBackfillResult> {
  const limit = options.limit ?? 400;
  const minSamples = options.minSamples ?? MIN_GROUP_SAMPLES;
  const log = options.log || (() => {});
  const result: ConsumptionBackfillResult = { groups: 0, updated: 0, filled: 0, candidates: 0, fillable: 0 };

  const groups = await loadMissingGroups(limit);
  result.candidates = groups.reduce((n, g) => n + g.count, 0);
  log(`${groups.length} grup incelenecek (${result.candidates.toLocaleString("tr-TR")} ilanın tüketimi boş)`);

  for (const group of groups) {
    const { brand, model, engine, fuel } = group._id;
    const normalizedFuel = normalizeFuelType(fuel);
    const samples = await Car.find(
      {
        ...PUBLIC_LISTING_FILTER,
        brand,
        model,
        "features.engineSize": engine,
        "features.avgFuelConsumption": { $nin: ["", null] },
        "features.avgFuelConsumptionSource": { $ne: "model-median" },
        "features.fuelType": { $nin: ["", null, "Bilinmiyor", "Belirtilmemiş"] },
      },
      { "features.avgFuelConsumption": 1, "features.fuelType": 1 }
    )
      .limit(500)
      .lean<Array<{ features?: { avgFuelConsumption?: string; fuelType?: string } }>>();

    const values = samples
      .filter((s) => normalizeFuelType(s.features?.fuelType) === normalizedFuel)
      .map((s) => parseConsumption(s.features?.avgFuelConsumption))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    if (values.length < minSamples) continue;

    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    result.groups++;
    result.filled++;
    result.fillable += group.count;
    if (options.dryRun) {
      log(`  [deneme] ${brand} ${model} ${engine}L ${normalizedFuel}: ${values.length} kaynak değeri → emsal medyanı ${median} lt (${group.count} ilan)`);
      continue;
    }

    const update = await Car.updateMany(
      {
        ...PUBLIC_LISTING_FILTER,
        brand,
        model,
        "features.engineSize": engine,
        "features.fuelType": fuel,
        $or: [
          { "features.avgFuelConsumption": "" },
          { "features.avgFuelConsumption": null },
          { "features.avgFuelConsumption": { $exists: false } },
        ],
      },
      { $set: {
        "features.avgFuelConsumption": `${median.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} lt`,
        "features.avgFuelConsumptionSource": "model-median",
      } },
      { timestamps: false }
    );
    result.updated += update.modifiedCount || 0;
  }

  log(`${result.filled} grup doldurulabilir, ${result.fillable.toLocaleString("tr-TR")} ilan etkilenecek`);
  return result;
}
