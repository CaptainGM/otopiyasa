
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com",
  "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org",
  "throwawaymail.com", "yopmail.com", "yopmail.fr", "getnada.com", "nada.email",
  "trashmail.com", "trashmail.de", "dispostable.com", "fakeinbox.com",
  "maildrop.cc", "mintemail.com", "mytemp.email", "emailondeck.com",
  "moakt.com", "tempr.email", "discard.email", "spamgourmet.com",
  "mailnesia.com", "mohmal.com", "harakirimail.com", "mvrht.net",
  "inboxkitten.com", "burnermail.io", "grr.la", "spam4.me",
  "tempmailo.com", "temp-mail.io", "luxusmail.org", "byom.de",
]);


export function emailDomain(email: string): string | null {
  const at = String(email || "").lastIndexOf("@");
  if (at === -1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

export function isDisposableEmail(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
 
  return [...DISPOSABLE_DOMAINS].some((d) => domain.endsWith(`.${d}`));
}


const DOT_INSENSITIVE = new Set(["gmail.com", "googlemail.com"]);

export function canonicalEmail(email: string): string {
  const value = String(email || "").trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at === -1) return value;

  let local = value.slice(0, at);
  const domain = value.slice(at + 1);


  const plus = local.indexOf("+");
  if (plus !== -1) local = local.slice(0, plus);

  if (DOT_INSENSITIVE.has(domain)) local = local.replace(/\./g, "");

  return `${local}@${domain}`;
}
