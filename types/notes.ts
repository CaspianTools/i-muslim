export type NoteItemType = "ayah" | "hadith" | "hadithBook" | "hadithCollection";

export interface NoteItemMeta {
  title: string;
  subtitle?: string | null;
  href: string;
  arabic?: string | null;
  locale?: string | null;
}

export interface NoteRecord {
  id: string;
  itemType: NoteItemType;
  itemId: string;
  text: string;
  itemMeta: NoteItemMeta;
  createdAt: string;
  updatedAt: string;
}

export const NOTE_ITEM_TYPES: readonly NoteItemType[] = [
  "ayah",
  "hadith",
  "hadithBook",
  "hadithCollection",
] as const;

export const MAX_NOTE_LENGTH = 5000;

export function isNoteItemType(v: unknown): v is NoteItemType {
  return typeof v === "string" && (NOTE_ITEM_TYPES as readonly string[]).includes(v);
}
