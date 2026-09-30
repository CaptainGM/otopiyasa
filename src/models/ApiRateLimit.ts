import mongoose, { Schema } from "mongoose";

const ApiRateLimitSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true },
    resetAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: false }
);

export const ApiRateLimit =
  mongoose.models.ApiRateLimit || mongoose.model("ApiRateLimit", ApiRateLimitSchema);
