

export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `En az ${PASSWORD_MIN_LENGTH} karakter`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "lower",
    label: "En az bir küçük harf (a-z)",
  
    test: (p) => /[a-zçğıöşü]/.test(p),
  },
  {
    id: "upper",
    label: "En az bir büyük harf (A-Z)",
    test: (p) => /[A-ZÇĞİÖŞÜ]/.test(p),
  },
  {
    id: "digit",
    label: "En az bir rakam (0-9)",
    test: (p) => /\d/.test(p),
  },
  {
    id: "special",
    label: "En az bir özel karakter (!@#$%…)",
    
    test: (p) => /[^\p{L}\p{N}\s]/u.test(p),
  },
];

export interface PasswordCheck {
  valid: boolean;
  
  failed: string[];
  
  results: { id: string; label: string; ok: boolean }[];
}

export function checkPassword(password: unknown): PasswordCheck {
  const value = typeof password === "string" ? password : "";
  const results = PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    ok: rule.test(value),
  }));
  const failed = results.filter((r) => !r.ok).map((r) => r.label);
  return { valid: failed.length === 0, failed, results };
}


export function passwordError(password: unknown): string | null {
  const check = checkPassword(password);
  if (check.valid) return null;
  return `Şifre yeterince güçlü değil. Eksikler: ${check.failed.join(", ")}.`;
}
