import { AuthShell } from "@/components/AuthShell";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Şifreni güvenle sıfırla"
      subtitle="E-posta adresine özel sıfırlama token'ı veritabanında saklanır ve 1 saat geçerlidir."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
