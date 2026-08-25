import mongoose, { Schema, models, model } from "mongoose";


const NotificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["comment", "business", "listing", "offer", "question", "report"],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    
    link: { type: String, default: "" },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, createdAt: -1 });

export const Notification =
  models.Notification || model("Notification", NotificationSchema);

export type NotificationDocument = mongoose.InferSchemaType<typeof NotificationSchema> & {
  _id: mongoose.Types.ObjectId;
};
