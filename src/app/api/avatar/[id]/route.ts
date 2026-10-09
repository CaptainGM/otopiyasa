import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { UserAvatar } from "@/models/UserAvatar";

// Bilerek revalidate/dynamic dışa aktarımı yok: adres sürümlü (?v=), tarayıcı ve CDN değişmez diye uzun süre saklar.

/** Yüklenmiş profil fotoğrafını verir. Yalnızca kullanıcı hâlâ "photo" seçiliyse; adres sürümlü olduğu için değişmez önbellek. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  if (!isValidObjectId(id)) return notFound();

  await connectDB();
  const user = await User.findById(id).select("avatarType").lean<{ avatarType?: string | null }>();
  if (!user || user.avatarType !== "photo") return notFound();
  const avatar = await UserAvatar.findOne({ userId: id }).select("data contentType").lean<{ data: unknown; contentType?: string }>();
  if (!avatar) return notFound();

  // lean() Buffer'ı bazı sürümlerde mongodb Binary olarak verir; ikisi de çözülür.
  const raw = avatar.data as { buffer?: Uint8Array } & Uint8Array;
  const bytes = Buffer.from(raw.buffer ? raw.buffer : raw);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": avatar.contentType || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
