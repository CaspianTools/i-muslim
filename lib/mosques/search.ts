import type { Mosque } from "@/types/mosque";
import { asciifyToken } from "./slug";

const STOPWORDS = new Set([
  "the",
  "of",
  "and",
  "in",
  "at",
  "a",
  "an",
  "al",
  "el",
]);

const MAX_TOKENS = 50;

export function tokenize(input: string | undefined | null): string[] {
  if (!input) return [];
  const normalized = asciifyToken(input).toLowerCase();
  return normalized
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

export function buildSearchTokens(mosque: Pick<Mosque, "name" | "city" | "country" | "altSpellings" | "languages" | "denomination" | "address">): string[] {
  const set = new Set<string>();
  for (const v of [mosque.name.en, mosque.name.ar, mosque.name.tr, mosque.name.id]) {
    for (const t of tokenize(v)) set.add(t);
  }
  for (const t of tokenize(mosque.city)) set.add(t);
  for (const t of tokenize(mosque.country)) set.add(t);
  for (const t of tokenize(mosque.address?.line1)) set.add(t);
  for (const alt of mosque.altSpellings ?? []) {
    for (const t of tokenize(alt)) set.add(t);
  }
  return Array.from(set).slice(0, MAX_TOKENS);
}

export function queryTokens(q: string): string[] {
  return tokenize(q).slice(0, 30);
}

// In-memory matcher used by the mock-data path and small datasets.
export function mosqueMatchesQuery(m: Mosque, q: string): boolean {
  const tokens = queryTokens(q);
  if (tokens.length === 0) return true;
  const haystack = new Set(m.searchTokens);
  return tokens.some((t) => haystack.has(t));
}
