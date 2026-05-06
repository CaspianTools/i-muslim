import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import {
  requirePermission,
  requirePermissionForLanguage,
  badRequest,
  notFound,
  serverError,
} from "@/lib/admin/api";
import { requireDb } from "@/lib/firebase/admin";
import { revalidateHadithCollection } from "@/lib/hadith/db";
import { ALL_LANGS } from "@/lib/translations";

export const runtime = "nodejs";

// Translatable languages = all configured langs minus Arabic (which is the
// original sacred text and never edited via the admin UI).
const NON_ARABIC_LANGS = ALL_LANGS.filter((l) => l !== "ar");

const translationsShape: Record<string, z.ZodOptional<z.ZodString>> = {};
for (const lang of NON_ARABIC_LANGS) {
  translationsShape[lang] = z.string().max(20000).optional();
}

const publishedTranslationsShape: Record<string, z.ZodOptional<z.ZodBoolean>> = {};
for (const lang of NON_ARABIC_LANGS) {
  publishedTranslationsShape[lang] = z.boolean().optional();
}

const PatchSchema = z
  .object({
    translations: z.object(translationsShape).partial().optional(),
    publishedTranslations: z.object(publishedTranslationsShape).partial().optional(),
    narrator: z.string().max(500).nullable().optional(),
    grade: z.string().max(200).nullable().optional(),
    tags: z.array(z.string().max(64)).max(50).optional(),
    notes: z.string().max(4000).nullable().optional(),
    published: z.boolean().optional(),
  })
  .strict();

const ALLOWED_COLLECTIONS = new Set([
  "bukhari", "muslim", "abudawud", "tirmidhi", "nasai",
  "ibnmajah", "malik", "nawawi", "qudsi",
]);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ collection: string; number: string }> },
) {
  // Read access is the floor; every PATCH writer must at minimum be allowed
  // to view the hadith they're editing.
  const auth = await requirePermission("hadith.read");
  if (!auth.ok) return auth.response;

  const { collection, number: numberParam } = await ctx.params;
  if (!ALLOWED_COLLECTIONS.has(collection)) return badRequest("Invalid collection");
  const number = Number(numberParam);
  if (!Number.isInteger(number) || number < 1) return badRequest("Invalid hadith number");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const p = parsed.data;

  // Per-language gate for translations payload.
  if (p.translations) {
    for (const [lang, value] of Object.entries(p.translations)) {
      if (typeof value !== "string") continue;
      const langAuth = await requirePermissionForLanguage("hadith.translate", lang);
      if (!langAuth.ok) return langAuth.response;
    }
  }

  // Anything that affects publish state — `publishedTranslations`, the global
  // `published` flag, or curated metadata fields — requires the publish perm.
  const touchesPublishState =
    !!p.publishedTranslations ||
    p.published !== undefined ||
    p.narrator !== undefined ||
    p.grade !== undefined ||
    p.tags !== undefined ||
    p.notes !== undefined;
  if (touchesPublishState) {
    const publishAuth = await requirePermission("hadith.publish");
    if (!publishAuth.ok) return publishAuth.response;
  }

  const id = `${collection}:${number}`;
  try {
    const db = requireDb();
    const ref = db.collection("hadith_entries").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return notFound(`Hadith ${id} not found`);

    const updates: Record<string, unknown> = {
      editedByAdmin: true,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: auth.session.email,
    };
    if (p.translations) {
      const existing = (snap.data()?.translations as Record<string, string | undefined>) ?? {};
      const existingEdited = (snap.data()?.editedTranslations as Record<string, boolean> | undefined) ?? {};
      const mergedTranslations: Record<string, string> = { ...existing } as Record<string, string>;
      const mergedEdited: Record<string, boolean> = { ...existingEdited };
      for (const lang of NON_ARABIC_LANGS) {
        const incoming = p.translations[lang as keyof typeof p.translations];
        if (typeof incoming === "string") {
          mergedTranslations[lang] = incoming;
          // Mark this lang as admin-edited so the per-language seeder
          // (scripts/seed-hadith-translation.ts) preserves it on re-seed.
          mergedEdited[lang] = true;
        } else if (mergedTranslations[lang] === undefined) {
          mergedTranslations[lang] = "";
        }
      }
      updates.translations = mergedTranslations;
      updates.editedTranslations = mergedEdited;
    }
    if (p.publishedTranslations) {
      const existing =
        (snap.data()?.publishedTranslations as Record<string, boolean> | undefined) ?? {};
      const merged: Record<string, boolean> = { ...existing };
      for (const lang of NON_ARABIC_LANGS) {
        const incoming = p.publishedTranslations[lang as keyof typeof p.publishedTranslations];
        if (typeof incoming === "boolean") merged[lang] = incoming;
      }
      updates.publishedTranslations = merged;
    }
    if (p.narrator !== undefined) updates.narrator = p.narrator;
    if (p.grade !== undefined) updates.grade = p.grade;
    if (p.tags !== undefined) updates.tags = p.tags;
    if (p.notes !== undefined) updates.notes = p.notes;
    if (p.published !== undefined) updates.published = p.published;

    await ref.update(updates);
    revalidateHadithCollection(collection);

    const after = await ref.get();
    return NextResponse.json({ ok: true, hadith: after.data() });
  } catch (err) {
    return serverError("Failed to update hadith", err);
  }
}
