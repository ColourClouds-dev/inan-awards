/**
 * sanitize.ts
 * Input sanitization utilities applied before writing to Firestore.
 */

// Matches HTML/script tags and common injection patterns
const HTML_TAG_RE = /<[^>]*>/g;
// Matches null bytes, zero-width characters, and other control chars (except \t \n \r)
const CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFEFF\u200B-\u200D\u2028\u2029]/g;
// Matches javascript: and data: URI schemes used in XSS
const XSS_URI_RE = /javascript\s*:/gi;

/**
 * Sanitize a plain text value:
 * - Trims leading/trailing whitespace
 * - Strips HTML tags
 * - Removes control characters (null bytes, zero-width spaces, etc.)
 * - Removes javascript: URI schemes
 */
export function sanitizeText(value: string): string {
  return value
    .trim()
    .replace(HTML_TAG_RE, '')
    .replace(XSS_URI_RE, '')
    .replace(CONTROL_CHAR_RE, '');
}

/**
 * Sanitize an email address:
 * - Trims and lowercases
 * - Removes characters that cannot appear in a valid email
 */
export function sanitizeEmail(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w.@+\-]/g, '');
}

/**
 * Sanitize a URL:
 * - Trims
 * - Removes javascript: and data: schemes
 */
export function sanitizeUrl(value: string): string {
  const trimmed = value.trim();
  if (/^(javascript:|data:)/i.test(trimmed)) return '';
  return trimmed;
}

/**
 * Enforce a maximum character length on a string.
 * Returns the value truncated to maxLen if it exceeds it.
 */
export function limitLength(value: string, maxLen: number): string {
  return value.length > maxLen ? value.slice(0, maxLen) : value;
}

/**
 * Convenience: sanitize + limit in one call.
 */
export function sanitizeAndLimit(value: string, maxLen: number): string {
  return limitLength(sanitizeText(value), maxLen);
}
