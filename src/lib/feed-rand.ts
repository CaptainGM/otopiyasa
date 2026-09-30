import { Car } from "@/models/Car";

/**
 * "Keşfet" akışının rastgele alanı (Car.rand) eksik olan ilanlara değer yazar.
 * Yeni şemayla eklenen ilanlar alanı kendiliğinden alır; bu yalnızca eski kayıtlar ve eski
 * kodla çalışan sunucunun (ör. henüz güncellenmemiş daemon) eklediği ilanlar içindir.
 * Rastgele ilanı akıştan dışlamamak için ucuz ve tekrarlanabilir olmalıdır.
 */
export async function backfillMissingRand(): Promise<number> {
  const res = await Car.updateMany(
    { rand: { $exists: false } },
    [{ $set: { rand: { $rand: {} } } }],
    { timestamps: false }
  );
  return res.modifiedCount || 0;
}
