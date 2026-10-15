import { Schema, models, model } from "mongoose";

/**
 * Mobil Google girişinde uygulamaya verilen tek kullanımlık bilet. Ham kod saklanmaz, yalnızca özeti.
 * Süresi dolan kayıtlar MongoDB TTL indeksiyle kendiliğinden silinir.
 */
const GoogleLoginTicketSchema = new Schema(
  {
    codeHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const GoogleLoginTicket = models.GoogleLoginTicket || model("GoogleLoginTicket", GoogleLoginTicketSchema);
