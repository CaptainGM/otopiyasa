"use client";

import { useState } from "react";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { PasswordConfirmField } from "@/components/PasswordConfirmField";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("Yeni şifreler birbiriyle eşleşmiyor.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Şifre güncellenemedi.");
      setSuccess(data.message || "Şifreniz güncellendi.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Şifre güncellenemedi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="currentPassword">
          Mevcut şifre
        </label>
        <input
          id="currentPassword"
          type="password"
          className="input"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="newPassword">
          Yeni şifre
        </label>
        <input
          id="newPassword"
          type="password"
          className="input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
        />
        <PasswordRequirements password={newPassword} />
      </div>

      <PasswordConfirmField
        password={newPassword}
        value={confirmPassword}
        onChange={setConfirmPassword}
        label="Yeni şifre (tekrar)"
      />

      {error && (
        <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {success}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
      </button>
    </form>
  );
}
