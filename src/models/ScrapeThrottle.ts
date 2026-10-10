import mongoose, { Schema } from "mongoose";

interface ScrapeThrottleDoc {
  key: string;
  nextAllowedAt?: Date;
  configuredGapMs?: number;
  configUntil?: Date;
}

const ScrapeThrottleSchema = new Schema<ScrapeThrottleDoc>(
  {
    key: { type: String, required: true, unique: true },
    nextAllowedAt: Date,
    configuredGapMs: Number,
    configUntil: Date,
  },
  { timestamps: false }
);

export const ScrapeThrottle =
  mongoose.models.ScrapeThrottle || mongoose.model<ScrapeThrottleDoc>("ScrapeThrottle", ScrapeThrottleSchema);
