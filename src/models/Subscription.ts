import mongoose, { Schema, models, model } from "mongoose";

const SubscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email: { type: String, required: true },
    brand: { type: String },
    model: { type: String },
    yearMin: { type: Number },
    yearMax: { type: Number },
    maxPrice: { type: Number },
   
    targetAvgPrice: { type: Number, default: null },
    active: { type: Boolean, default: true },
    lastNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);


SubscriptionSchema.index({ brand: 1, model: 1, maxPrice: 1 });

export const Subscription = models.Subscription || model("Subscription", SubscriptionSchema);

export type SubscriptionDocument = mongoose.InferSchemaType<typeof SubscriptionSchema> & {
  _id: mongoose.Types.ObjectId;
};
