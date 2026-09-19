import mongoose, { Schema, models, model } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
   
    canonicalEmail: { type: String, index: true, sparse: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    favorites: [{ type: Schema.Types.ObjectId, ref: "Car" }],
    resetTokenHash: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null },
   
    emailVerified: { type: Boolean, default: false },
    verifyTokenHash: { type: String, default: null },
    verifyTokenExpires: { type: Date, default: null },
  
    accountType: { type: String, enum: ["individual", "business"], default: "individual" },
    businessName: { type: String, default: "" },
    businessPhone: { type: String, default: "" },
    businessStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
      index: true,
    },
    businessRejectionReason: { type: String, default: "" },

  
    emailChangePendingEmail: { type: String, default: null },
    emailChangeCurrentCodeHash: { type: String, default: null },
    emailChangeNewCodeHash: { type: String, default: null },
    emailChangeCodeExpires: { type: Date, default: null },
    emailChangeAttempts: { type: Number, default: 0 },

    
    chatSuspendedUntil: { type: Date, default: null },
   
    muteCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User = models.User || model("User", UserSchema);

export type UserDocument = mongoose.InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};
