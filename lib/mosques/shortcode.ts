import { randomBytes } from "node:crypto";

/**
 * Crockford base32 alphabet (no I, L, O, U — avoids visual/spoken ambiguity).
 * 32 symbols → a 7-char code is one of 32^7 ≈ 34 billion, plenty for a global
 * mosque directory with negligible collision odds (still checked at mint time).
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const SHORT_CODE_LENGTH = 7;

/** Validates the shape of a short code (the `/m/<code>` segment). */
export function isShortCode(value: string): boolean {
  if (value.length < 4 || value.length > 12) return false;
  for (const ch of value.toUpperCase()) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}

/** Normalize an inbound `/m/<code>` segment for lookup (codes are stored upper-case). */
export function normalizeShortCode(value: string): string {
  return value.trim().toUpperCase();
}

/** Generate a single random short code (NOT collision-checked — see the data layer). */
export function randomShortCode(length: number = SHORT_CODE_LENGTH): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}
