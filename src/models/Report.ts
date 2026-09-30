import mongoose, { Schema, models, model } from "mongoose";


export const REPORT_REASONS = [
  "satildi",
  "yanlis-bilgi",
  "dolandiricilik",
  "kufur-hakaret",
  "uygunsuz",
  "diger",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

const ReportSchema = new Schema(
  {
    car: { type: Schema.Types.ObjectId, ref: "Car", required: true, index: true },
    reporter: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    note: { type: String, default: "", maxlength: 500 },
    status: {
      type: String,
      enum: ["open", "reviewed", "dismissed"],
      default: "open",
      index: true,
    },

    
    offer: { type: Schema.Types.ObjectId, ref: "Offer", default: undefined },
  
    reportedUser: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
    
    chatSnapshot: { type: String, default: undefined, maxlength: 4000 },
  },
  { timestamps: true }
);


ReportSchema.index(
  { car: 1, reporter: 1 },
  { unique: true, partialFilterExpression: { offer: { $exists: false } } }
);

ReportSchema.index(
  { offer: 1, reporter: 1 },
  { unique: true, partialFilterExpression: { offer: { $exists: true } } }
);

export const Report = models.Report || model("Report", ReportSchema);

export type ReportDocument = mongoose.InferSchemaType<typeof ReportSchema> & {
  _id: mongoose.Types.ObjectId;
};
