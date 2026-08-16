// User-submitted reports that a hadith, Quran verse or tafsir passage has a
// content problem (wrong translation, typo, incorrect Arabic, etc.). Written
// only via the `flagContentAction` server action and triaged from
// `/admin/flags`.

export type ContentFlagItemType = "hadith" | "ayah" | "tafsir";

/**
 * Single source of truth for the accepted item types. Imported by BOTH the
 * normalizer in lib/admin/data/content-flags.ts AND the submit guard in
 * flag-actions.ts — those two lists were previously duplicated, so extending
 * only one produced a normalizer that accepted a type the submit path 400'd on.
 */
export const CONTENT_FLAG_ITEM_TYPES: readonly ContentFlagItemType[] = [
  "hadith",
  "ayah",
  "tafsir",
] as const;

export type ContentFlagStatus = "open" | "resolved" | "dismissed";

export interface ContentFlag {
  id: string;
  itemType: ContentFlagItemType;
  // hadith: "collectionId/bookNumber/number"; ayah: verse_key like "2:255";
  // tafsir: "{workId}:{lang}:{blockId}" like "ibn-kathir:ar:002-008".
  itemId: string;
  // Human-readable label, e.g. "Sahih al-Bukhari — Book 1 #2" / "Al-Baqarah 2:255".
  reference: string;
  // Public deep-link to the flagged item.
  href: string;
  // Locale the reporter was viewing — tells the admin which translation is meant.
  locale: string;
  // Free-text description of what's wrong (trimmed, ≤500 chars; may be empty).
  note: string;
  reporterUid: string;
  reporterEmail: string | null;
  status: ContentFlagStatus;
  createdAt: string; // ISO
  resolvedAt?: string; // ISO
  resolvedBy?: string; // admin email
}
