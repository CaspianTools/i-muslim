import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiError, apiOk } from "@/lib/api/responses";
import { requireDb } from "@/lib/firebase/admin";
import { revalidateSurah } from "@/lib/quran/db";
import { ALL_LANGS } from "@/lib/translations";
import { QuranTranslationPutSchema } from "@/lib/api/validators";
import { writeApiAuditLog } from "@/lib/api/audit";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ surah: string; ayah: string; locale: string }> },
) {
  const auth = await validateApiKey(req, "quran", "write");
  if (!auth.authenticated) return auth.error;

  const headers = rateLimitHeaders(auth.rateLimit);
  const { surah: surahParam, ayah: ayahParam, locale } = await ctx.params;
  const surah = Number(surahParam);
  const ayah = Number(ayahParam);
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    return apiError("VALIDATION_ERROR", "Invalid surah", 400, headers);
  }
  if (!Number.isInteger(ayah) || ayah < 1) {
    return apiError("VALIDATION_ERROR", "Invalid ayah", 400, headers);
  }
  if (locale === "ar") {
    return apiError(
      "FORBIDDEN_LOCALE",
      "Arabic (text_ar) is read-only and cannot be written via API",
      403,
      headers,
    );
  }
  if (!ALL_LANGS.includes(locale)) {
    return apiError(
      "VALIDATION_ERROR",
      `Locale '${locale}' is not supported. Allowed: ${ALL_LANGS.filter((l) => l !== "ar").join(", ")}`,
      400,
      headers,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON", 400, headers);
  }
  const parsed = QuranTranslationPutSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid body",
      400,
      headers,
    );
  }
  const { text } = parsed.data;

  const db = requireDb();
  const ref = db.collection("quran_ayahs").doc(`${surah}:${ayah}`);
  const snap = await ref.get();
  if (!snap.exists) {
    return apiError("NOT_FOUND", `Ayah ${surah}:${ayah} not found`, 404, headers);
  }
  const data = snap.data() ?? {};
  const existing = (data.translations as Record<string, string | undefined>) ?? {};
  const before = existing[locale] ?? null;

  await ref.update({
    [`translations.${locale}`]: text,
    editedByApi: true,
    lastEditingKeyId: auth.keyId,
    lastEditingKeyName: auth.keyName,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: `apiKey:${auth.keyId}`,
  });
  revalidateSurah(surah);

  await writeApiAuditLog({
    actor: { kind: "apiKey", keyId: auth.keyId, keyName: auth.keyName },
    action: "quran.translation.upsert",
    resourceType: "ayah",
    resourceId: `${surah}:${ayah}`,
    before: { locale, text: before },
    after: { locale, text },
    details: { surah, ayah, locale },
  });

  return apiOk({ surah, ayah, locale, text }, { headers });
}
