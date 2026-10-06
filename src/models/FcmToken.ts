import mongoose, { Schema, models, model } from "mongoose";

const FcmTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, unique: true },
    /** Jetonun kaydedildiği oturum (JWT jti): oturum kapanınca bu cihaza bildirim gitmez (bkz. lib/push-sessions.ts). */
    jti: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

export const FcmToken = models.FcmToken || model("FcmToken", FcmTokenSchema);

export type FcmTokenDocument = mongoose.InferSchemaType<typeof FcmTokenSchema> & {
  _id: mongoose.Types.ObjectId;
};
