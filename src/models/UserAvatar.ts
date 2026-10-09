import { Schema, models, model } from "mongoose";

/**
 * Kullanıcının yüklediği profil fotoğrafı (256 px JPEG, EXIF'i temizlenmiş, denetimden geçmiş). Görüntü User belgesine konmaz:
 * birçok uç kullanıcıyı `.select` olmadan okuyor, her seferinde fotoğraf baytlarını da taşımasın.
 */
const UserAvatarSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    data: { type: Buffer, required: true },
    contentType: { type: String, default: "image/jpeg" },
    version: { type: Number, default: 1 },
    moderatedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const UserAvatar = models.UserAvatar || model("UserAvatar", UserAvatarSchema);
