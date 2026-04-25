import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin, badRequest, notFound, serverError } from "@/lib/admin/api";
import { requireDb } from "@/lib/firebase/admin";
import { revalidateHadithCollection } from "@/lib/hadith/db";

export const runtime = "nodejs";

const PatchSchema = z
  .object({
    translations: z
      .object({
        en: z.string().max(20000).optional(),
        ru: z.string().max(20000).optional(),
      })
      .partial()
      .optional(),
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
  const auth = await requireAdmin();
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
    const p = parsed.data;
    if (p.translations) {
      const existing = (snap.data()?.translations as { en?: string; ru?: string }) ?? {};
      updates.translations = {
        en: p.translations.en ?? existing.en ?? "",
        ru: p.translations.ru ?? existing.ru ?? "",
      };
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
