// User-submitted reports that a hadith or Quran verse has a content problem
// (wrong translation, typo, incorrect Arabic, etc.). Written only via the
// `flagContentAction` server action and triaged from `/admin/flags`.

export type ContentFlagItemType = "hadith" | "ayah";

export type ContentFlagStatus = "open" | "resolved" | "dismissed";

export interface ContentFlag {
  id: string;
  itemType: ContentFlagItemType;
  // hadith: "collectionId/bookNumber/number"; ayah: verse_key like "2:255".
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
