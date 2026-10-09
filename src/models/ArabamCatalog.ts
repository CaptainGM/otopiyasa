import { Schema, models, model } from "mongoose";

/**
 * Kaynağın kendi marka → model listesi (marka sayfasındaki "model" filtresi, sayılarıyla). Hangi modelin ayrı model sayılacağını
 * (ör. "i20", "i20 N", "i20 Active" ayrı) ve kaynakta hangi modelde kaç ilan olduğunu buradan okuruz; elle liste tutulmaz.
 * Bkz. src/lib/scraper/arabam-catalog.ts.
 */
const ArabamCatalogSchema = new Schema(
  {
    category: { type: String, required: true },
    brandSlug: { type: String, required: true },
    brand: { type: String, required: true },
    /** Kaynaktaki bu kategori + marka ilan sayısı. */
    brandCount: { type: Number, default: 0 },
    models: {
      type: [
        {
          _id: false,
          name: String,
          /** "hyundai-i20-n" (kategori hariç adres parçası). */
          slug: String,
          /** Kaynaktaki ilan sayısı. */
          count: Number,
        },
      ],
      default: [],
    },
    fetchedAt: { type: Date, required: true },
  },
  { timestamps: false }
);

ArabamCatalogSchema.index({ category: 1, brandSlug: 1 }, { unique: true });

export const ArabamCatalog = models.ArabamCatalog || model("ArabamCatalog", ArabamCatalogSchema);

export type CatalogModel = { name: string; slug: string; count: number };
export type ArabamCatalogDoc = {
  category: string;
  brandSlug: string;
  brand: string;
  brandCount: number;
  models: CatalogModel[];
  fetchedAt: Date;
};

