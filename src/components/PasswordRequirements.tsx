"use client";

import { checkPassword } from "@/lib/password-policy";


export function PasswordRequirements({ password }: { password: string }) {
  if (!password) return null;
  const { results, valid } = checkPassword(password);

  return (
    <ul className="mt-2 space-y-1" aria-live="polite">
      {results.map((rule) => (
        <li
          key={rule.id}
          className={`flex items-center gap-1.5 text-xs ${
            rule.ok ? "text-emerald-300" : "text-slate-500"
          }`}
        >
          <span aria-hidden className="w-3 shrink-0 text-center">
            {rule.ok ? "✓" : "•"}
          </span>
          {rule.label}
        </li>
      ))}
      {valid && (
        <li className="pt-0.5 text-xs font-semibold text-emerald-300">
          Şifren güçlü 👍
        </li>
      )}
    </ul>
  );
}
