import { User } from "@/models/User";
import { canonicalEmail } from "@/lib/email-policy";
import type { GoogleProfile } from "@/lib/google-auth";

/** Aynı e-postaya bağlı başka bir Google hesabı varsa bağlama yapılmaz. */
export class GoogleAccountConflictError extends Error {
  constructor() {
    super("Bu e-posta adresi başka bir Google hesabına bağlı.");
    this.name = "GoogleAccountConflictError";
  }
}

/**
 * Google kimliğine karşılık gelen hesabı bulur; yoksa aynı e-postalı hesaba bağlar ya da yeni hesap açar.
 *
 * Doğrulanmamış (e-postası hiç onaylanmamış) bir hesap Google ile bağlanırsa eski şifresi silinir:
 * o şifreyi başkası (e-postanın gerçek sahibi olmayan biri) belirlemiş olabilir ve bağlamadan sonra da
 * girişe açık kalırdı. Google e-postanın sahibini zaten doğruladığı için hesap sahibine ait kalır.
 */
export async function findOrLinkGoogleUser(profile: GoogleProfile) {
  const byGoogle = await User.findOne({ googleSub: profile.sub });
  if (byGoogle) return byGoogle;

  const email = profile.email.toLowerCase();
  const canonical = canonicalEmail(email);
  const existing = await User.findOne({ $or: [{ email }, { canonicalEmail: canonical }] });

  if (existing) {
    if (existing.googleSub && existing.googleSub !== profile.sub) {
      throw new GoogleAccountConflictError();
    }
    if (existing.emailVerified === false) {
      existing.passwordHash = null;
      existing.verifyTokenHash = null;
      existing.verifyTokenExpires = null;
      existing.emailVerified = true;
    }
    existing.googleSub = profile.sub;
    await existing.save();
    return existing;
  }

  return User.create({
    name: (profile.name || email.split("@")[0]).trim().slice(0, 60),
    email,
    canonicalEmail: canonical,
    passwordHash: null,
    googleSub: profile.sub,
    favorites: [],
    emailVerified: true,
  });
}
