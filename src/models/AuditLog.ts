import mongoose, { Schema, models, model } from "mongoose";


export const AUDIT_ACTIONS = [
  "listing_approved",
  "listing_rejected",
  "business_approved",
  "business_rejected",
  "report_reviewed",
  "report_dismissed",
  "car_deleted",
  "user_warned",
  "user_muted",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const AuditLogSchema = new Schema(
  {
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    
    actor: { type: String, default: "system" },
    targetLabel: { type: String, default: "" },
    reason: { type: String, default: "" },
  },
  { timestamps: true }
);

AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = models.AuditLog || model("AuditLog", AuditLogSchema);

export type AuditLogDocument = mongoose.InferSchemaType<typeof AuditLogSchema> & {
  _id: mongoose.Types.ObjectId;
};
