import { AuthShell } from "@/components/AuthShell";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Yeni şifreni belirle"
      subtitle="Güçlü bir şifre seç ve hesabına tekrar giriş yap."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
