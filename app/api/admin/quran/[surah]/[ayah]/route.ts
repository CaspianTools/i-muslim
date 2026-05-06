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
import { revalidateSurah } from "@/lib/quran/db";
import { ALL_LANGS } from "@/lib/translations";

export const runtime = "nodejs";

// Translatable languages = all configured langs minus Arabic (which is the
// original sacred text and never edited via the admin UI).
const NON_ARABIC_LANGS = ALL_LANGS.filter((l) => l !== "ar");

const translationsShape: Record<string, z.ZodOptional<z.ZodString>> = {};
for (const lang of NON_ARABIC_LANGS) {
  translationsShape[lang] = z.string().max(8000).optional();
}

const PatchSchema = z
  .object({
    translations: z.object(translationsShape).partial().optional(),
    text_translit: z.string().max(8000).nullable().optional(),
    tags: z.array(z.string().max(64)).max(50).optional(),
    notes: z.string().max(4000).nullable().optional(),
    published: z.boolean().optional(),
  })
  .strict();

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ surah: string; ayah: string }> },
) {
  // Read access is the floor; every PATCH writer must at minimum be allowed
  // to view the ayah they're editing.
  const auth = await requirePermission("quran.read");
  if (!auth.ok) return auth.response;

  const { surah: surahParam, ayah: ayahParam } = await ctx.params;
  const surah = Number(surahParam);
  const ayah = Number(ayahParam);
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    return badRequest("Invalid surah");
  }
  if (!Number.isInteger(ayah) || ayah < 1) {
    return badRequest("Invalid ayah");
  }

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

  if (p.translations) {
    for (const [lang, value] of Object.entries(p.translations)) {
      if (typeof value !== "string") continue;
      const langAuth = await requirePermissionForLanguage("quran.translate", lang);
      if (!langAuth.ok) return langAuth.response;
    }
  }

  // Transliteration, tags, notes, and the global publish flag are admin-curated.
  const touchesPublishState =
    p.text_translit !== undefined ||
    p.tags !== undefined ||
    p.notes !== undefined ||
    p.published !== undefined;
  if (touchesPublishState) {
    const publishAuth = await requirePermission("quran.publish");
    if (!publishAuth.ok) return publishAuth.response;
  }

  const id = `${surah}:${ayah}`;
  try {
    const db = requireDb();
    const ref = db.collection("quran_ayahs").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return notFound(`Ayah ${id} not found`);

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
          // (scripts/seed-quran-translation.ts) preserves it on re-seed.
          mergedEdited[lang] = true;
        }
      }
      updates.translations = mergedTranslations;
      updates.editedTranslations = mergedEdited;
    }
    if (p.text_translit !== undefined) updates.text_translit = p.text_translit;
    if (p.tags !== undefined) updates.tags = p.tags;
    if (p.notes !== undefined) updates.notes = p.notes;
    if (p.published !== undefined) updates.published = p.published;

    await ref.update(updates);
    revalidateSurah(surah);

    const after = await ref.get();
    return NextResponse.json({ ok: true, ayah: after.data() });
  } catch (err) {
    return serverError("Failed to update ayah", err);
  }
}
