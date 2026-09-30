import mongoose, { Schema, models, model } from "mongoose";



export type OfferStatus = "pending" | "accepted" | "rejected" | "expired";


const OfferEventSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["offer", "accepted", "rejected", "message", "expired"],
      required: true,
    },
    
    author: { type: Schema.Types.ObjectId, ref: "User", default: null },
   
    amount: { type: Number, default: null },
   
    text: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const OfferSchema = new Schema(
  {
    car: { type: Schema.Types.ObjectId, ref: "Car", required: true, index: true },
    buyer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },


    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired"],
      default: "pending",
      index: true,
    },

   
    chatEnabled: { type: Boolean, default: false },
    
    expiresAt: { type: Date, default: null },

    events: { type: [OfferEventSchema], default: [] },

   
    buyerSeenAt: { type: Date, default: null },
    sellerSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);


OfferSchema.index({ car: 1, buyer: 1 }, { unique: true });

OfferSchema.index({ seller: 1, updatedAt: -1 });
OfferSchema.index({ buyer: 1, updatedAt: -1 });

export const Offer = models.Offer || model("Offer", OfferSchema);

export type OfferDocument = mongoose.InferSchemaType<typeof OfferSchema> & {
  _id: mongoose.Types.ObjectId;
};
