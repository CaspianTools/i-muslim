/**
 * HTML normalization for sacred-text rendering.
 *
 * Translation text from upstream sources (quran.com, the Diyanet ml=1 meal)
 * arrives with two kinds of markup we never want to show the reader verbatim:
 *
 *   1. footnote tags  — `<sup foot_note="123">1</sup>`
 *   2. HTML entities  — `&quot;` for ", `&#39;` for ', `&amp;` for & …
 *
 * `stripHtml` removes the tags AND decodes the entities so the rendered string
 * is plain, faithful text. Shared by the public reader, search, the daily-ayah
 * cards, and the seed/import scripts (so stored data is clean at the source).
 *
 * Pure (no `server-only`, no framework imports) so it runs in server
 * components, the App Router, and the Node-based `tsx` seed scripts alike.
 */

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

/** Code point → string, rejecting out-of-range / surrogate values instead of throwing. */
function fromCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
    return "";
  }
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

/**
 * Decode the HTML entities that appear in our translation sources. Named
 * entities and numeric (decimal / hex) references are handled; `&amp;` is
 * decoded LAST so `&amp;quot;` resolves to the literal `&quot;`, not `"`.
 * Unknown / invalid references are left untouched rather than dropped.
 */
export function decodeHtmlEntities(s: string): string {
  if (!s || s.indexOf("&") === -1) return s;
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex: string) => fromCodePoint(parseInt(hex, 16)) || m)
    .replace(/&#(\d+);/g, (m, dec: string) => fromCodePoint(parseInt(dec, 10)) || m)
    .replace(/&(quot|apos|lt|gt|nbsp);/g, (m, name: string) => NAMED_ENTITIES[name] ?? m)
    .replace(/&amp;/g, "&");
}

/**
 * Strip HTML tags (e.g. quran.com `<sup>` footnote markers), decode HTML
 * entities, and trim. Output is plain text — safe as a React text child, which
 * React escapes on render.
 *
 * NOTE: this removes the `<sup>` tags but keeps their inner content. The Saheeh
 * International (en) source puts a bare digit inside (`<sup …>1</sup>`), so that
 * digit survives — use `cleanQuranTranslation` (below) for English translation
 * text, which strips those footnote-marker digits too.
 */
export function stripHtml(s: string): string {
  return decodeHtmlEntities(s.replace(/<[^>]+>/g, "")).trim();
}

/**
 * Remove the bare footnote-marker digits the Saheeh International (en) source
 * flattens into the prose once its `<sup>` tags are gone — "Merciful.2" →
 * "Merciful.", "We2 have" → "We have". English-only; callers gate on lang
 * because ru/az/tr carry no such markers and may use digits legitimately.
 * Mirrors the fix in the i-muslim-quran mobile app (tools/build-quran-db.mjs).
 */
export function stripFootnoteMarkers(s: string): string {
  return s
    .replace(/\d+/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/** Strip HTML/entities; for English also drop footnote-marker digits. */
export function cleanQuranTranslation(text: string, lang: string): string {
  const stripped = stripHtml(text);
  return lang === "en" ? stripFootnoteMarkers(stripped) : stripped;
}
