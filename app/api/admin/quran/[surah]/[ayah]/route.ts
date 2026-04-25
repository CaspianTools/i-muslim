import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin, badRequest, notFound, serverError } from "@/lib/admin/api";
import { requireDb } from "@/lib/firebase/admin";
import { revalidateSurah } from "@/lib/quran/db";

export const runtime = "nodejs";

const PatchSchema = z
  .object({
    translations: z
      .object({
        en: z.string().max(8000).optional(),
        ru: z.string().max(8000).optional(),
      })
      .partial()
      .optional(),
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
  const auth = await requireAdmin();
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

    const p = parsed.data;
    if (p.translations) {
      const existing = (snap.data()?.translations as { en?: string; ru?: string }) ?? {};
      updates.translations = {
        en: p.translations.en ?? existing.en ?? "",
        ru: p.translations.ru ?? existing.ru ?? "",
      };
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
