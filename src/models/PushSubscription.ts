import mongoose, { Schema, models, model } from "mongoose";


const PushSubscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    /** Aboneliğin açıldığı oturum (JWT jti): oturum kapanınca bu tarayıcıya bildirim gitmez. */
    jti: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

export const PushSubscription =
  models.PushSubscription || model("PushSubscription", PushSubscriptionSchema);

export type PushSubscriptionDocument = mongoose.InferSchemaType<
  typeof PushSubscriptionSchema
> & { _id: mongoose.Types.ObjectId };
