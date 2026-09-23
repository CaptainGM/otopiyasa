"use client";

import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

interface PasswordConfirmFieldProps {
 
  password: string;
 
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
 
  name?: string;
}


export function passwordsMatch(password: string, confirm: string): boolean {
  return password.length > 0 && confirm.length > 0 && password === confirm;
}

export function PasswordConfirmField({
  password,
  value,
  onChange,
  id = "confirmPassword",
  label = "Şifre (tekrar)",
  name,
}: PasswordConfirmFieldProps) {
  const match = passwordsMatch(password, value);
  const mismatch = value.length > 0 && password !== value;

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        className={`input ${mismatch ? "border-red-400/60" : match ? "border-emerald-400/60" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        required
      />
      {mismatch && <p className="mt-1 text-xs text-red-400">Şifreler eşleşmiyor.</p>}
      {match && <p className="mt-1 text-xs text-emerald-400">Şifreler eşleşiyor.</p>}
    </div>
  );
}
