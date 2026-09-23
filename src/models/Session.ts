import mongoose, { Schema, models, model } from "mongoose";

const SessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jti: { type: String, required: true, unique: true, index: true },
    deviceLabel: { type: String, default: "Bilinmeyen cihaz" },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    lastSeenAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Session = models.Session || model("Session", SessionSchema);

export type SessionDocument = mongoose.InferSchemaType<typeof SessionSchema> & {
  _id: mongoose.Types.ObjectId;
};
