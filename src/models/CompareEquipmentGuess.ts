import { Schema, models, model } from "mongoose";

/**
 * Donanım kural motorunun "bilinmiyor" bıraktığı öğeler için AI'nın (Gemini) verdiği en olası tahmin, araç başına
 * önbelleklenir. Aynı ilan ikinci kez karşılaştırmaya girince AI'ya tekrar sorulmaz, aynı cevap döner — hem paylaşımlı
 * günlük AI bütçesini (bkz. ai-guard.ts) korur hem de aynı aracın görüntülemeden görüntülemeye "Var"/"Yok" değiştirmesini
 * önler. Kural motoru her istekte yeniden çalışır: bir öğe sonradan kuralla "var"/"yok" çözülürse (kod güncellenirse)
 * önbellekteki eski tahmin artık okunmaz (bkz. src/app/api/compare/equipment-ai/route.ts).
 */
const CompareEquipmentGuessSchema = new Schema(
  {
    carId: { type: Schema.Types.ObjectId, required: true, unique: true },
    /** itemId -> present (true/false). */
    guesses: { type: Map, of: Boolean, default: {} },
    model: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const CompareEquipmentGuess = models.CompareEquipmentGuess || model("CompareEquipmentGuess", CompareEquipmentGuessSchema);
