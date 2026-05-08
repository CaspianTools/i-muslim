import "server-only";
import { z } from "zod";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { ALL_LANGS, type LangCode } from "@/lib/translations";
import { recomputeTranslationStats } from "../../scripts/recompute-translation-stats";

const NON_ARABIC_LANGS = ALL_LANGS.filter((l) => l !== "ar");
const PLACEHOLDER_PREFIX = "[TRANSLATE TO ";
const WRITE_BATCH = 400;

const translationsShape: Record<string, z.ZodOptional<z.ZodString>> = {};
for (const lang of NON_ARABIC_LANGS) {
  translationsShape[lang] = z.string().max(20000).optional();
}
const publishedTranslationsShape: Record<
  string,
  z.ZodOptional<z.ZodBoolean>
> = {};
for (const lang of NON_ARABIC_LANGS) {
  publishedTranslationsShape[lang] = z.boolean().optional();
}

// Loose enough to accept v1 (no `status`) and v2 (with `status`); strict on
// the fields we actually consume.
const HadithEntrySchema = z
  .object({
    number: z.number().int().min(1),
    translations: z.object(translationsShape).partial().optional(),
    status: z.enum(["draft", "published"]).optional(),
    publishedTranslations: z.object(publishedTranslationsShape).partial().optional(),
  })
  .passthrough();

const ImportPayloadSchema = z
  .object({
    schema: z.string().optional(),
    lang: z.string(),
    collection: z.object({ slug: z.string() }).passthrough(),
    hadith: z.array(HadithEntrySchema).max(20000),
  })
  .passthrough();

export type HadithImportResult = {
  collection: string;
  lang: string;
  updated: number;
  skippedPlaceholder: number;
  skippedNoChange: number;
  errors: Array<{ number: number; reason: string }>;
};

function isPlaceholder(text: string): boolean {
  return text.startsWith(PLACEHOLDER_PREFIX);
}

/**
 * Merge a translated hadith export back into Firestore.
 *
 * - `lang === "all"` payloads use each entry's `publishedTranslations` map.
 * - single-language payloads use `status: "draft" | "published"` and write
 *   only that language.
 * - Always overwrites existing translation text and stamps
 *   `editedTranslations.<lang> = true` (mirrors the per-hadith PATCH route)
 *   so future seed runs preserve the upload.
 * - `text_ar`, `narrator`, `grade`, `grades`, `tags`, `notes`, `published`
 *   are reference-only and never touched.
 */
export async function mergeHadithExport(
  firestore: Firestore,
  payload: unknown,
  opts: {
    actorEmail: string | null;
    canPublish: boolean;
    expectedCollection: string;
  },
): Promise<HadithImportResult> {
  const parsed = ImportPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ImportValidationError(
      "Validation failed",
      parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    );
  }
  const data = parsed.data;
  if (data.collection.slug !== opts.expectedCollection) {
    throw new ImportValidationError(
      `Collection mismatch: payload is for "${data.collection.slug}", route is "${opts.expectedCollection}"`,
    );
  }
  const lang = data.lang;
  const isAll = lang === "all";
  if (!isAll && !(ALL_LANGS as readonly string[]).includes(lang)) {
    throw new ImportValidationError(`Unknown language code "${lang}"`);
  }
  if (!isAll && lang === "ar") {
    throw new ImportValidationError(
      "Arabic is the original sacred text, not a translation target.",
    );
  }

  const result: HadithImportResult = {
    collection: opts.expectedCollection,
    lang,
    updated: 0,
    skippedPlaceholder: 0,
    skippedNoChange: 0,
    errors: [],
  };

  const col = firestore.collection("hadith_entries");
  let pending = firestore.batch();
  let pendingCount = 0;
  let touchedCount = 0;

  for (const entry of data.hadith) {
    const id = `${opts.expectedCollection}:${entry.number}`;
    const ref = col.doc(id);

    // Build the per-doc update. We `set(..., { merge: true })` rather than
    // `update()` so a missing doc still creates correctly (rare but possible).
    const updates: Record<string, unknown> = {};
    let touchesThisDoc = false;

    if (isAll) {
      // v1/all-mode: merge translations + publishedTranslations as-is.
      const incomingTranslations = entry.translations ?? {};
      const mergedTranslations: Record<string, string> = {};
      const mergedEdited: Record<string, boolean> = {};
      for (const code of NON_ARABIC_LANGS) {
        const text = incomingTranslations[code];
        if (typeof text !== "string") continue;
        if (text.length === 0 || isPlaceholder(text)) continue;
        mergedTranslations[code] = text;
        mergedEdited[code] = true;
      }
      if (Object.keys(mergedTranslations).length > 0) {
        updates.translations = mergedTranslations;
        updates.editedTranslations = mergedEdited;
        touchesThisDoc = true;
      }
      if (opts.canPublish && entry.publishedTranslations) {
        const merged: Record<string, boolean> = {};
        for (const code of NON_ARABIC_LANGS) {
          const flag = entry.publishedTranslations[code];
          if (typeof flag === "boolean") merged[code] = flag;
        }
        if (Object.keys(merged).length > 0) {
          // Guard: refuse to publish a language whose incoming text is still
          // a placeholder for that language.
          for (const [code, flag] of Object.entries(merged)) {
            if (flag !== true) continue;
            const text = incomingTranslations[code];
            if (typeof text === "string" && isPlaceholder(text)) {
              result.errors.push({
                number: entry.number,
                reason: `Cannot publish placeholder text for "${code}"`,
              });
              merged[code] = false;
            }
          }
          updates.publishedTranslations = merged;
          touchesThisDoc = true;
        }
      }
    } else {
      // single-lang mode: status field drives publishedTranslations[lang].
      const text = entry.translations?.[lang];
      const hasRealText = typeof text === "string" && text.length > 0 && !isPlaceholder(text);
      const incomingStatus = entry.status; // "draft" | "published" | undefined

      if (hasRealText) {
        updates.translations = { [lang]: text };
        updates.editedTranslations = { [lang]: true };
        touchesThisDoc = true;
      } else if (
        incomingStatus === "published" &&
        typeof text === "string" &&
        isPlaceholder(text)
      ) {
        // Translator forgot to fill in but tried to publish — surface the
        // error and skip both the text and status writes for this doc.
        result.errors.push({
          number: entry.number,
          reason: `Cannot publish placeholder text for "${lang}"`,
        });
        result.skippedPlaceholder++;
        continue;
      } else {
        // Empty / missing / placeholder text → silent no-op.
        result.skippedPlaceholder++;
        continue;
      }

      if (opts.canPublish && incomingStatus) {
        updates.publishedTranslations = {
          [lang]: incomingStatus === "published",
        };
        touchesThisDoc = true;
      }
    }

    if (!touchesThisDoc) {
      result.skippedNoChange++;
      continue;
    }

    updates.editedByAdmin = true;
    updates.updatedAt = FieldValue.serverTimestamp();
    if (opts.actorEmail) updates.updatedBy = opts.actorEmail;

    pending.set(ref, updates, { merge: true });
    pendingCount++;
    touchedCount++;
    result.updated++;

    if (pendingCount >= WRITE_BATCH) {
      await pending.commit();
      pending = firestore.batch();
      pendingCount = 0;
    }
  }

  if (pendingCount > 0) await pending.commit();

  if (touchedCount > 0) {
    try {
      await recomputeTranslationStats(firestore);
    } catch (err) {
      console.error("[hadith-import] recomputeTranslationStats failed", err);
    }
  }

  return result;
}

export class ImportValidationError extends Error {
  readonly issues: Array<{ path: string; message: string }>;
  constructor(
    message: string,
    issues: Array<{ path: string; message: string }> = [],
  ) {
    super(message);
    this.name = "ImportValidationError";
    this.issues = issues;
  }
}

export type { LangCode };
