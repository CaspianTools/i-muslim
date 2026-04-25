// Slug helpers. Mosque slugs are immutable post-publish; renames produce a new slug + redirect.
const RESERVED_PATHS = new Set([
  "submit",
  "near-me",
  "c",
  "claim",
  "queue",
  "new",
  "edit",
  "import",
  "report",
  "api",
]);

const ARABIC_TRANSLITERATION: Array<[RegExp, string]> = [
  [/مسجد/g, "masjid"],
  [/جامع/g, "jami"],
];

export function asciifyToken(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ə/g, "e")
    .replace(/ñ/g, "n");
}

export function slugify(input: string): string {
  let s = (input ?? "").trim();
  for (const [re, repl] of ARABIC_TRANSLITERATION) {
    s = s.replace(re, repl);
  }
  s = asciifyToken(s).toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s.slice(0, 80);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_PATHS.has(slug);
}

export function buildMosqueSlug(name: string, citySlug: string): string {
  const base = slugify(name);
  const city = slugify(citySlug);
  if (!base) return city || "mosque";
  if (!city) return base;
  if (base.endsWith(`-${city}`) || base === city) return base;
  return `${base}-${city}`;
}

export function withCollisionSuffix(base: string, taken: Set<string>): string {
  if (!taken.has(base) && !isReservedSlug(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`) || isReservedSlug(`${base}-${i}`)) {
    i += 1;
    if (i > 999) throw new Error("Slug collision space exhausted");
  }
  return `${base}-${i}`;
}
