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
 * NOTE: this removes the `<sup>` tags but keeps their inner content. quran.com
 * puts a bare digit inside (`<sup …>1</sup>`), so that digit survives — use
 * `cleanQuranTranslation` (below) for translation text, which removes the
 * markers whole.
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
    // Only strip digits that are a footnote marker — i.e. glued directly to the
    // end of a word ("We2") or to a word's terminal punctuation ("Merciful.2").
    // Standalone or grouped numerals a translation might legitimately contain
    // ("12 months", "1,000", "3.14") are left intact.
    .replace(/(?<=[A-Za-z])\d+/g, "")
    .replace(/(?<=[A-Za-z][.,;:!?])\d+/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/** One or more adjacent quran.com footnote markers, with the whitespace around them. */
const FOOTNOTE_TAGS = /(?:\s*<sup\b[^>]*\bfoot_note\b[^>]*>[\s\S]*?<\/sup>)+\s*/gi;

/**
 * Remove quran.com footnote markers whole — the `<sup foot_note=…>` tag *and*
 * the digit inside it, for every language.
 *
 * `stripHtml` alone keeps the digit, which the English-only
 * `stripFootnoteMarkers` then has to find again in the flattened prose. Every
 * other language was assumed to carry no markers, and the Kemenag (id) edition
 * disproves it: 930 of them, so 2:255 would read "Kursi-Nya1 meliputi langit".
 *
 * The marker is not always where a digit-stripping pass would expect it — the
 * old English pass left "polytheists."1" and "[in Islām]1 to" behind. It can
 * stand between two spaces, or be the only thing separating two words
 * ("sedekah.<sup>1</sup>Allah"). So at either end of the text, or before
 * punctuation that closes what came before, it simply goes; anywhere else the
 * text keeps its own spacing — one space if it had any beside the marker, or if
 * the marker was all that stood between two words. A straight quote is left
 * out of the punctuation test on purpose: it opens as often as it closes, and
 * `unlearned,<sup>1</sup> "Have` must keep its space.
 */
export function stripFootnoteTags(s: string): string {
  return s.replace(FOOTNOTE_TAGS, (match: string, offset: number, whole: string) => {
    const prev = whole[offset - 1];
    const next = whole[offset + match.length];
    if (prev === undefined || next === undefined || /[.,;:!?)\]]/.test(next)) return "";
    return /\s/.test(match) || /[\p{L}\p{N}([]/u.test(next) ? " " : "";
  });
}

/** Strip footnote markers, HTML and entities; for English also drop footnote-marker digits. */
export function cleanQuranTranslation(text: string, lang: string): string {
  const stripped = stripHtml(stripFootnoteTags(text));
  return lang === "en" ? stripFootnoteMarkers(stripped) : stripped;
}
