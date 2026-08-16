// Provenance and licensing for tafsir (Quran commentary) texts.
//
// Mirrors lib/translations/catalog.ts and reuses its `TranslationCatalogEntry`
// shape so `gateText` in lib/api/translations/respond.ts keeps working verbatim
// if a public tafsir endpoint is ever added.
//
// TWO SEPARATE AXES — do not conflate them:
//
//   `redistribute`  governs handing the TEXT to third parties: the public
//                   /api/v1/* download endpoints and the offline mobile
//                   bundles. This is the legal seatbelt and it must keep
//                   exactly one meaning.
//   `renderOnSite`  governs whether i-muslim.com displays the text on its own
//                   pages. Publishing a text ourselves, with attribution and a
//                   visible provenance notice, is a different act from shipping
//                   it inside someone else's APK or JSON download.
//
// The Indonesian set is the reason the two exist. Its publisher rights are
// unverified, so it is withheld from redistribution but still rendered here
// with a notice. If a rights-holder objects, flip `renderOnSite` to false and
// push — the site deploys on push to main, so that is a minutes-long revert
// with no data migration and no Firestore write to 5,251 documents.

import type { TranslationCatalogEntry } from "@/lib/translations/catalog";
import type { TafsirLang } from "./works";

export type TafsirCatalogEntry = TranslationCatalogEntry & {
  workId: string;
  lang: TafsirLang;
  /** The specific printed/critical edition this text follows. */
  edition: string;
  abridged: boolean;
  /** Whether i-muslim.com renders the text. Orthogonal to `redistribute`. */
  renderOnSite: boolean;
  /** Provenance line shown to readers beneath the text. */
  siteNotice?: string;
};

export const TAFSIR_CATALOG: Record<string, TafsirCatalogEntry> = {
  "ibn-kathir:ar": {
    sourceId: "qul:22",
    workId: "ibn-kathir",
    lang: "ar",
    attribution: "Ibn Kathir (d. 774 AH) — Tafsir al-Qur'an al-'Azim",
    edition:
      "Dar Taybah critical edition, tahqiq Sami b. Muhammad Salamah (2nd ed., 1420/1999)",
    abridged: false,
    license: "Public Domain (classical text)",
    sourceUrl: "https://github.com/spa5k/tafsir_api",
    redistribute: "full",
    renderOnSite: true,
    // The 8th-century text is public domain. The muhaqqiq's editorial
    // apparatus is NOT — upstream keeps it in a separate `editor_notes` array
    // and scripts/seed-tafsir.ts asserts it is never written to Firestore.
  },
  "ibn-kathir:id": {
    sourceId: "hardknockdays/alquran-tafsir-json-dataset",
    workId: "ibn-kathir",
    lang: "id",
    attribution:
      "Indonesian translation — likely Pustaka Imam Asy-Syafi'i (M. Abdul Ghoffar)",
    edition: "Unabridged, full isnads",
    abridged: false,
    license: "Unverified — publisher rights not established",
    sourceUrl: "https://github.com/hardknockdays/alquran-tafsir-json-dataset",
    redistribute: "metadata-only",
    notice:
      "Indonesian Ibn Kathir rights are unverified — the source repository's licence " +
      "covers the compilation, not the publisher's translation copyright. Text is " +
      "withheld here; fetch it from source_url.",
    renderOnSite: true,
    siteNotice:
      "Indonesian translation; publisher unconfirmed. If you hold the rights to this " +
      "translation, please contact us.",
  },
};

export function tafsirCatalogKey(workId: string, lang: TafsirLang): string {
  return `${workId}:${lang}`;
}

export function getTafsirCatalogEntry(
  workId: string,
  lang: TafsirLang,
): TafsirCatalogEntry | null {
  return TAFSIR_CATALOG[tafsirCatalogKey(workId, lang)] ?? null;
}

/** Languages of `workId` that may be rendered on i-muslim.com right now. */
export function renderableTafsirLangs(
  workId: string,
  langs: readonly TafsirLang[],
): TafsirLang[] {
  return langs.filter((l) => getTafsirCatalogEntry(workId, l)?.renderOnSite === true);
}
