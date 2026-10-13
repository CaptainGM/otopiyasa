import mongoose, { Schema } from "mongoose";

/**
 * Pahalı hesaplanan, yavaş değişen özetlerin önceden hesaplanmış kaydı (ad başına tek belge). Vercel'de her yeni sunucu örneği
 * bu özetleri sıfırdan hesaplarsa ilk istek saniyelerce bekler; bu yüzden motor (scripts/daemon.ts) saatte bir yazar, site okur.
 * Veri düz JSON metni olarak tutulur: anahtarında nokta olan nesneler ("bmw|320i|1.6|benzin") belgeye güvenle yazılamaz.
 */
export interface StatSnapshotDoc {
  name: string;
  json: string;
  computedAt: Date;
}

const StatSnapshotSchema = new Schema<StatSnapshotDoc>({
  name: { type: String, required: true, unique: true },
  json: { type: String, required: true },
  computedAt: { type: Date, required: true },
});

export const StatSnapshot =
  mongoose.models.StatSnapshot || mongoose.model<StatSnapshotDoc>("StatSnapshot", StatSnapshotSchema);
