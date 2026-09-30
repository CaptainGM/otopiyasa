import mongoose, { Schema } from "mongoose";

/**
 * Sitemap'ten bulunan, henüz detayı çekilmemiş yeni ilan adayları.
 * Keşif iki adımdır: günlük sitemap senkronu adayları buraya yazar (engelsiz, hafif),
 * ev ağındaki motor kuyruktan en yeni ilanları alıp detay sayfasını gerçek tarayıcıyla
 * okur. Başarılı ya da kalıcı olarak okunamayan aday kuyruktan silinir.
 */
export interface DiscoveryCandidateDoc {
  source: string;
  externalId: string;
  numericId: number;
  url: string;
  lastmod?: string;
  attempts: number;
  lastAttemptAt?: Date;
}

const DiscoveryCandidateSchema = new Schema<DiscoveryCandidateDoc>(
  {
    source: { type: String, required: true },
    externalId: { type: String, required: true },
    // Arabam ilan numaraları zamanla artar; en yeni ilanlar en büyük numaralardır.
    numericId: { type: Number, required: true },
    url: { type: String, required: true },
    lastmod: String,
    attempts: { type: Number, default: 0 },
    lastAttemptAt: Date,
  },
  { timestamps: true }
);

DiscoveryCandidateSchema.index({ source: 1, externalId: 1 }, { unique: true });
DiscoveryCandidateSchema.index({ source: 1, attempts: 1, numericId: -1 });

export const DiscoveryCandidate =
  mongoose.models.DiscoveryCandidate ||
  mongoose.model<DiscoveryCandidateDoc>("DiscoveryCandidate", DiscoveryCandidateSchema);
