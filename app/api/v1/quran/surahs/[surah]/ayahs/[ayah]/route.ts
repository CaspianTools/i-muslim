import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import { requireDb } from "@/lib/firebase/admin";
import { revalidateSurah } from "@/lib/quran/db";
import { ALL_LANGS } from "@/lib/translations";
import { QuranAyahPatchSchema } from "@/lib/api/validators";
import { writeApiAuditLog } from "@/lib/api/audit";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ surah: string; ayah: string }> },
) {
  const auth = await validateApiKey(req, "quran", "read");
  if (!auth.authenticated) return withCors(auth.error);

  const { surah: surahParam, ayah: ayahParam } = await ctx.params;
  const surah = Number(surahParam);
  const ayah = Number(ayahParam);
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    return withCors(apiError("VALIDATION_ERROR", "Invalid surah", 400));
  }
  if (!Number.isInteger(ayah) || ayah < 1) {
    return withCors(apiError("VALIDATION_ERROR", "Invalid ayah", 400));
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
  const doc = await db.collection("quran_ayahs").doc(`${surah}:${ayah}`).get();
  if (!doc.exists) {
    return withCors(apiError("NOT_FOUND", `Ayah ${surah}:${ayah} not found`, 404));
  }
  const data = doc.data() as {
    surah: number;
    ayah: number;
    text_ar: string;
    text_translit?: string | null;
    translations?: Record<string, string | undefined>;
    juz?: number;
    page?: number;
    sajdah?: boolean;
    published?: boolean;
  };
  if (!data.published) {
    return withCors(apiError("NOT_FOUND", `Ayah ${surah}:${ayah} not found`, 404));
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
        surah: data.surah,
        ayah: data.ayah,
        text_ar: data.text_ar,
        text_translit: data.text_translit ?? null,
        translations,
        juz: data.juz ?? null,
        page: data.page ?? null,
        sajdah: data.sajdah ?? false,
      },
      { headers: rateLimitHeaders(auth.rateLimit) },
    ),
  );
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ surah: string; ayah: string }> },
) {
  const auth = await validateApiKey(req, "quran", "write");
  if (!auth.authenticated) return auth.error;

  const headers = rateLimitHeaders(auth.rateLimit);
  const { surah: surahParam, ayah: ayahParam } = await ctx.params;
  const surah = Number(surahParam);
  const ayah = Number(ayahParam);
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    return apiError("VALIDATION_ERROR", "Invalid surah", 400, headers);
  }
  if (!Number.isInteger(ayah) || ayah < 1) {
    return apiError("VALIDATION_ERROR", "Invalid ayah", 400, headers);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON", 400, headers);
  }
  const parsed = QuranAyahPatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid body",
      400,
      headers,
    );
  }

  const db = requireDb();
  const ref = db.collection("quran_ayahs").doc(`${surah}:${ayah}`);
  const snap = await ref.get();
  if (!snap.exists) {
    return apiError("NOT_FOUND", `Ayah ${surah}:${ayah} not found`, 404, headers);
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
  if (p.tags !== undefined) updates.tags = p.tags;
  if (p.notes !== undefined) updates.notes = p.notes;
  if (p.published !== undefined) updates.published = p.published;

  await ref.update(updates);
  revalidateSurah(surah);

  await writeApiAuditLog({
    actor: { kind: "apiKey", keyId: auth.keyId, keyName: auth.keyName },
    action: "quran.metadata.patch",
    resourceType: "ayah",
    resourceId: `${surah}:${ayah}`,
    before: {
      tags: beforeData.tags ?? [],
      notes: beforeData.notes ?? null,
      published: beforeData.published ?? false,
    },
    after: p,
  });

  return apiOk({ ok: true, surah, ayah }, { headers });
}
