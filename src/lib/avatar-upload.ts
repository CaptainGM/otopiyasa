import sharp from "sharp";
import { AVATAR_SIZE_PX, type DetectedImage } from "@/lib/avatar";

/**
 * Yüklenen görüntüyü 256×256 JPEG'e yeniden kodlar: EXIF (konum dahil) ve gömülü her şey atılır, yön düzeltilir, kare kesilir.
 * Bozuk ya da çok büyük çözünürlüklü dosya hata verir (sharp piksel sınırı).
 */
export async function normalizeAvatar(image: DetectedImage): Promise<Buffer> {
  return sharp(image.bytes, { limitInputPixels: 24_000_000 })
    .rotate()
    .resize(AVATAR_SIZE_PX, AVATAR_SIZE_PX, { fit: "cover", position: "centre" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}
