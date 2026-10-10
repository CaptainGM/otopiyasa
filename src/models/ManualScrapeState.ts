import { Schema, models, model } from "mongoose";

/** Elle başlatılan (scrape.bat / panel) taramanın "şu an çalışıyor" işareti; sunucu uç noktası iş sürerken 30 sn'de bir yeniler. */
const ManualScrapeStateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "manual" },
    running: { type: Boolean, default: false },
    label: { type: String, default: "" },
    actor: { type: String, default: "" },
    ownerToken: { type: String, default: null },
    startedAt: { type: Date, default: null },
    heartbeatAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: false }
);

export const ManualScrapeState = models.ManualScrapeState || model("ManualScrapeState", ManualScrapeStateSchema);
