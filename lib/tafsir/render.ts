// Tokenizer for tafsir prose.
//
// Pure and framework-free — no `server-only`, no `"use client"` — so the same
// renderer runs in the server-rendered block pages, in the client-side inline
// panel, and in the Node seed script. This mirrors the note at the top of
// lib/text/html.ts, which is the established pattern here.
//
// Why not lib/blog/markdown.ts: the corpus is plain text, not Markdown. Running
// it through remark would reinterpret line-leading `#`, `*`, `-` and `[...]`
// editorial brackets as structure and turn `_`/`*` inside transliterations into
// emphasis — silently altering sacred text, which CLAUDE.md forbids. It also
// costs a six-stage unified pipeline per request on a 1-vCPU box, and forces
// `dangerouslySetInnerHTML`. Rendering tokens as React text children escapes
// everything by construction, so there is no XSS surface at all.
//
// The scanner below is a single forward pass with no backtracking. That is
// deliberate: an earlier regex-and-slice version went quadratic on the largest
// blocks (004-155 is 123 KB) and hung. Blocks this size run on every request,
// so the tokenizer has to be linear.

import type { TafsirLang } from "./works";

export type TafsirToken =
  | { kind: "text"; value: string }
  /** A Quran quotation. Arabic uses ornate parens; the brackets are kept. */
  | { kind: "quran"; value: string }
  /** An Arabic run embedded in non-Arabic prose (hadith matn, a phrase). */
  | { kind: "arabic"; value: string }
  /** A single glyph standing for a whole phrase, e.g. ﷺ. */
  | { kind: "honorific"; value: string };

const ORNATE_OPEN = 0xfd3f; // ﴿
const ORNATE_CLOSE = 0xfd3e; // ﴾

/** ﷺ ﷻ ﷲ — single glyphs screen readers handle inconsistently. */
const HONORIFIC_CODES = new Set([0xfdfa, 0xfdfb, 0xfdf2]);

/** True for Arabic-script letters and combining marks (not ornate parens). */
function isArabicChar(code: number): boolean {
  return (
    (code >= 0x0600 && code <= 0x06ff) || // Arabic
    (code >= 0x0750 && code <= 0x077f) || // Arabic Supplement
    (code >= 0x08a0 && code <= 0x08ff) || // Arabic Extended-A
    (code >= 0xfb50 && code <= 0xfdff) || // Presentation Forms-A
    (code >= 0xfe70 && code <= 0xfeff) // Presentation Forms-B
  );
}

/** Arabic letters proper — excludes marks/punctuation, used for run density. */
function isArabicLetter(code: number): boolean {
  return (
    (code >= 0x0620 && code <= 0x064a) ||
    (code >= 0x0671 && code <= 0x06d3) ||
    (code >= 0x0750 && code <= 0x077f) ||
    (code >= 0x08a0 && code <= 0x08ff)
  );
}

/** Characters allowed to sit *inside* an Arabic run without ending it. */
function isArabicRunFiller(code: number): boolean {
  return (
    code === 0x20 || // space
    code === 0x060c || // ،
    code === 0x061b || // ؛
    code === 0x061f || // ؟
    code === 0x0640 // ـ tatweel
  );
}

/** Normalise line endings and split on blank lines. Drops empty paragraphs. */
export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function arabicLetterCount(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (isArabicLetter(text.charCodeAt(i))) n++;
  }
  return n;
}

/**
 * Direction for one paragraph. Arabic blocks are RTL throughout. Indonesian
 * blocks routinely carry a full hadith matn as its own paragraph — rendering
 * that as one inline run inside a left-aligned LTR paragraph reads badly, so a
 * paragraph that is overwhelmingly Arabic becomes RTL in its own right.
 */
export function paragraphDirection(
  text: string,
  lang: TafsirLang,
): "rtl" | "ltr" {
  if (lang === "ar") return "rtl";
  let dense = 0;
  let arabic = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) continue;
    dense++;
    if (isArabicChar(code)) arabic++;
  }
  if (dense === 0) return "ltr";
  return arabic / dense >= 0.8 ? "rtl" : "ltr";
}

/**
 * Split a paragraph into typed tokens in a single linear pass.
 *
 * In Arabic prose only Quran quotations and honorifics are marked — running the
 * embedded-Arabic pass there would wrap the whole paragraph. In Indonesian
 * prose, Arabic runs are additionally isolated so bidirectional layout and
 * adjacent Latin punctuation come out right.
 *
 * Concatenating every token's `value` reproduces the input exactly; the seed
 * script asserts that round-trip over the whole corpus.
 */
export function tokenizeParagraph(
  text: string,
  lang: TafsirLang,
): TafsirToken[] {
  const wantArabicRuns = lang !== "ar";
  const tokens: TafsirToken[] = [];
  let buf = "";

  const flush = () => {
    if (buf) {
      tokens.push({ kind: "text", value: buf });
      buf = "";
    }
  };

  let i = 0;
  while (i < text.length) {
    const code = text.charCodeAt(i);

    // ﴿ … ﴾ — a Quran quotation. Verified balanced across the whole corpus
    // (26,686 spans, zero unbalanced blocks); an unterminated one degrades to
    // plain text rather than swallowing the rest of the paragraph.
    if (code === ORNATE_OPEN) {
      const close = text.indexOf(String.fromCharCode(ORNATE_CLOSE), i + 1);
      if (close !== -1) {
        flush();
        tokens.push({ kind: "quran", value: text.slice(i, close + 1) });
        i = close + 1;
        continue;
      }
    }

    if (HONORIFIC_CODES.has(code)) {
      flush();
      tokens.push({ kind: "honorific", value: text[i] as string });
      i += 1;
      continue;
    }

    if (wantArabicRuns && isArabicChar(code)) {
      // Consume the maximal Arabic run, then trim trailing filler so spacing
      // between the run and the next Latin word stays outside the isolate.
      let j = i;
      let lastLetter = i;
      while (j < text.length) {
        const c = text.charCodeAt(j);
        if (isArabicChar(c)) {
          if (!HONORIFIC_CODES.has(c)) lastLetter = j;
          else break;
          j++;
        } else if (isArabicRunFiller(c) && j + 1 < text.length) {
          j++;
        } else {
          break;
        }
      }
      const run = text.slice(i, lastLetter + 1);
      // Require two Arabic letters so a stray glyph in Latin prose is left alone.
      if (arabicLetterCount(run) >= 2) {
        flush();
        tokens.push({ kind: "arabic", value: run });
        i = lastLetter + 1;
        continue;
      }
    }

    buf += text[i];
    i += 1;
  }

  flush();
  return tokens.filter((t) => t.value.length > 0);
}

/**
 * Texts the Indonesian dataset uses where it has no commentary to give. They
 * are marked `type: "content"` upstream, but none of them are Ibn Kathir's
 * words — 51 say the original does not treat the verse separately, one is a
 * bare "sorry, not available yet", and the rest are cross-references. Rendering
 * them as commentary would attribute a dataset artefact to the author, so the
 * UI frames them as a note from the edition instead of hiding or dressing them
 * up. Matched at render time rather than baked into Firestore, so a corpus
 * revision doesn't need a re-ingest to be classified correctly.
 */
const EDITORIAL_NOTE_PATTERNS: readonly RegExp[] = [
  /^tafsir ayat ini (tidak|hanya|telah) diterangkan/i,
  /^maaf, tafsir belum tersedia/i,
  /^lihat tafsir ayat/i,
  /^telah dijelaskan pada ayat sebelumnya/i,
  /^penjelasan mengenai huruf-huruf yang terdapat pada awal surah/i,
];

/**
 * True when a passage is an editorial placeholder rather than commentary.
 * Deliberately conservative: only matches short texts, so a real passage that
 * happens to open with one of these phrases is never misclassified.
 */
export function isEditorialNote(text: string, lang: TafsirLang): boolean {
  if (lang !== "id") return false;
  const flat = text.trim();
  if (flat.length > 200) return false;
  return EDITORIAL_NOTE_PATTERNS.some((re) => re.test(flat));
}

/** Plain-text excerpt for listings, metadata and JSON-LD `abstract`. */
export function tafsirExcerpt(text: string, max = 240): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
