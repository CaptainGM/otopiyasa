import Link from "next/link";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getCurrentUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ChangeEmailForm } from "@/components/ChangeEmailForm";
import { PushToggle } from "@/components/PushToggle";
import { DevicesSection } from "@/components/DevicesSection";
import { BusinessSection } from "@/components/BusinessSection";
import { stageOf, maskEmail } from "@/lib/email-change";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const authUser = await getCurrentUser();
  if (!authUser) redirect("/login");

  await connectDB();
  const user = await User.findById(authUser.userId)
    .select(
      "name email role favorites createdAt businessStatus businessName businessRejectionReason " +
        "emailChangePendingEmail emailChangeCurrentCodeHash emailChangeNewCodeHash emailChangeCodeExpires"
    )
    .lean<{
      name: string;
      email: string;
      role: string;
      favorites?: unknown[];
      createdAt?: Date;
      businessStatus?: "none" | "pending" | "approved" | "rejected";
      businessName?: string;
      businessRejectionReason?: string;
      emailChangePendingEmail?: string | null;
      emailChangeCurrentCodeHash?: string | null;
      emailChangeNewCodeHash?: string | null;
      emailChangeCodeExpires?: Date | null;
    }>();

  if (!user) redirect("/login");

  const emailChangeStage = stageOf({
    pendingEmail: user.emailChangePendingEmail,
    currentCodeHash: user.emailChangeCurrentCodeHash,
    newCodeHash: user.emailChangeNewCodeHash,
    codeExpires: user.emailChangeCodeExpires,
  });

  const favoriteCount = user.favorites?.length || 0;
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-2xl font-black text-[#221202]">
          {initials || "?"}
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">{user.name}</h1>
          <p className="text-sm text-slate-400">{user.email}</p>
        </div>
        {user.role === "admin" && (
          <span className="badge badge-accent ml-auto">Yönetici</span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="stat-tile flex-col items-start">
          <span className="text-xs uppercase tracking-widest text-slate-500">Favoriler</span>
          <strong className="mt-1 text-2xl">{favoriteCount}</strong>
          <Link href="/favorites" className="mt-1 text-xs text-amber-300 hover:underline">
            Favorilere git →
          </Link>
        </div>
        <div className="stat-tile flex-col items-start">
          <span className="text-xs uppercase tracking-widest text-slate-500">Rol</span>
          <strong className="mt-1 text-2xl capitalize">
            {user.role === "admin" ? "Yönetici" : "Üye"}
          </strong>
        </div>
        <div className="stat-tile flex-col items-start">
          <span className="text-xs uppercase tracking-widest text-slate-500">Üyelik</span>
          <strong className="mt-1 text-lg">{memberSince}</strong>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-1 text-lg font-semibold">Hesap bilgileri</h2>
          <p className="mb-5 text-sm text-slate-500">Profil bilgilerin.</p>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <dt className="text-slate-500">Ad Soyad</dt>
              <dd className="font-medium">{user.name}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <dt className="text-slate-500">E-posta</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Hesap türü</dt>
              <dd className="font-medium">{user.role === "admin" ? "Yönetici" : "Üye"}</dd>
            </div>
          </dl>
        </div>

        <div className="card p-6">
          <h2 className="mb-1 text-lg font-semibold">Şifre değiştir</h2>
          <p className="mb-5 text-sm text-slate-500">
            Güvenliğin için mevcut şifreni doğrulayıp yeni şifreni iki kez gir.
          </p>
          <ChangePasswordForm />
        </div>

        <div className="card p-6">
          <h2 className="mb-1 text-lg font-semibold">E-posta değiştir</h2>
          <p className="mb-5 text-sm text-slate-500">
            Telefon doğrulaması olmadığı için önce mevcut, sonra yeni adresine gönderdiğimiz kodları
            girerek e-postanı güvenle değiştirebilirsin.
          </p>
          <ChangeEmailForm
            currentEmail={user.email}
            initialStage={emailChangeStage}
            maskedCurrentEmail={maskEmail(user.email)}
            maskedPendingEmail={user.emailChangePendingEmail ? maskEmail(user.emailChangePendingEmail) : null}
          />
        </div>
      </div>

      <BusinessSection
        status={user.businessStatus || "none"}
        businessName={user.businessName || ""}
        rejectionReason={user.businessRejectionReason || ""}
      />

      <DevicesSection />

      <PushToggle />
    </div>
  );
}
