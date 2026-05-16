import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import { requireDb } from "@/lib/firebase/admin";
import { ALL_LANGS } from "@/lib/translations";
import { HadithPatchSchema } from "@/lib/api/validators";
import { writeApiAuditLog } from "@/lib/api/audit";
import { revalidateHadithCollection } from "@/lib/hadith/db";

export const runtime = "nodejs";

const ALLOWED_COLLECTIONS = new Set([
  "bukhari", "muslim", "abudawud", "tirmidhi", "nasai",
  "ibnmajah", "malik", "nawawi", "qudsi",
]);

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; number: string }> },
) {
  const auth = await validateApiKey(req, "hadith", "read");
  if (!auth.authenticated) return withCors(auth.error);

  const { id, number: numberParam } = await ctx.params;
  const number = Number(numberParam);
  if (!Number.isInteger(number) || number < 1) {
    return withCors(apiError("VALIDATION_ERROR", "Invalid hadith number", 400));
  }

  const url = new URL(req.url);
  const translationsParam = url.searchParams.get("translations");
  const langs = translationsParam
    ? translationsParam
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => ALL_LANGS.includes(s))
    : ALL_LANGS.filter((l) => l !== "ar");

  const db = requireDb();
  const doc = await db.collection("hadith_entries").doc(`${id}:${number}`).get();
  if (!doc.exists) {
    return withCors(apiError("NOT_FOUND", `Hadith ${id}:${number} not found`, 404));
  }
  const data = doc.data() as {
    collection: string;
    number: number;
    arabic_number?: number;
    book: number;
    hadith_in_book?: number;
    text_ar: string;
    translations?: Record<string, string | undefined>;
    narrator?: string | null;
    grade?: string | null;
    grades?: Array<{ name: string; grade: string }>;
    tags?: string[];
    notes?: string | null;
    published?: boolean;
  };
  if (!data.published) {
    return withCors(apiError("NOT_FOUND", `Hadith ${id}:${number} not found`, 404));
  }

  const translations: Record<string, string> = {};
  if (data.translations) {
    for (const l of langs) {
      if (l === "ar") continue;
      const v = data.translations[l];
      if (typeof v === "string" && v.length > 0) translations[l] = v;
    }
  }

  return withCors(
    apiOk(
      {
        collection: data.collection,
        number: data.number,
        arabic_number: data.arabic_number ?? null,
        book: data.book,
        hadith_in_book: data.hadith_in_book ?? null,
        text_ar: data.text_ar,
        translations,
        narrator: data.narrator ?? null,
        grade: data.grade ?? null,
        grades: data.grades ?? [],
        tags: data.tags ?? [],
        notes: data.notes ?? null,
      },
      { headers: rateLimitHeaders(auth.rateLimit) },
    ),
  );
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; number: string }> },
) {
  const auth = await validateApiKey(req, "hadith", "write");
  if (!auth.authenticated) return auth.error;

  const headers = rateLimitHeaders(auth.rateLimit);
  const { id, number: numberParam } = await ctx.params;

  if (!ALLOWED_COLLECTIONS.has(id)) {
    return apiError("VALIDATION_ERROR", "Invalid hadith collection", 400, headers);
  }
  const number = Number(numberParam);
  if (!Number.isInteger(number) || number < 1) {
    return apiError("VALIDATION_ERROR", "Invalid hadith number", 400, headers);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON", 400, headers);
  }
  const parsed = HadithPatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid body",
      400,
      headers,
    );
  }

  const db = requireDb();
  const ref = db.collection("hadith_entries").doc(`${id}:${number}`);
  const snap = await ref.get();
  if (!snap.exists) {
    return apiError("NOT_FOUND", `Hadith ${id}:${number} not found`, 404, headers);
  }
  const beforeData = snap.data() ?? {};

  const updates: Record<string, unknown> = {
    editedByApi: true,
    lastEditingKeyId: auth.keyId,
    lastEditingKeyName: auth.keyName,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: `apiKey:${auth.keyId}`,
  };
  const p = parsed.data;
  if (p.narrator !== undefined) updates.narrator = p.narrator;
  if (p.grade !== undefined) updates.grade = p.grade;
  if (p.tags !== undefined) updates.tags = p.tags;
  if (p.notes !== undefined) updates.notes = p.notes;
  if (p.published !== undefined) updates.published = p.published;

  await ref.update(updates);
  revalidateHadithCollection(id);

  await writeApiAuditLog({
    actor: { kind: "apiKey", keyId: auth.keyId, keyName: auth.keyName },
    action: "hadith.metadata.patch",
    resourceType: "hadith",
    resourceId: `${id}:${number}`,
    before: {
      narrator: beforeData.narrator ?? null,
      grade: beforeData.grade ?? null,
      tags: beforeData.tags ?? [],
      notes: beforeData.notes ?? null,
      published: beforeData.published ?? false,
    },
    after: p,
  });

  return apiOk({ ok: true, collection: id, number }, { headers });
}
