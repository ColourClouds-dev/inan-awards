export const STANDARD_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'yandex.com',
  'mail.com',
  'gmx.com',
]);

/** Returns true if the email belongs to a custom/work domain (not a standard consumer domain). */
export function isCustomDomainEmail(email: string): boolean {
  if (!email || !email.includes('@')) return true;
  const domain = email.split('@').pop()?.trim().toLowerCase() ?? '';
  return !STANDARD_DOMAINS.has(domain);
}
