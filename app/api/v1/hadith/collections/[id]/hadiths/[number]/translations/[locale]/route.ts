import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiError, apiOk } from "@/lib/api/responses";
import { requireDb } from "@/lib/firebase/admin";
import { revalidateHadithCollection } from "@/lib/hadith/db";
import { ALL_LANGS } from "@/lib/translations";
import { HadithTranslationPutSchema } from "@/lib/api/validators";
import { writeApiAuditLog } from "@/lib/api/audit";

export const runtime = "nodejs";

const ALLOWED_COLLECTIONS = new Set([
  "bukhari", "muslim", "abudawud", "tirmidhi", "nasai",
  "ibnmajah", "malik", "nawawi", "qudsi",
]);

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; number: string; locale: string }> },
) {
  const auth = await validateApiKey(req, "hadith", "write");
  if (!auth.authenticated) return auth.error;

  const headers = rateLimitHeaders(auth.rateLimit);
  const { id, number: numberParam, locale } = await ctx.params;

  if (!ALLOWED_COLLECTIONS.has(id)) {
    return apiError("VALIDATION_ERROR", "Invalid hadith collection", 400, headers);
  }
  const number = Number(numberParam);
  if (!Number.isInteger(number) || number < 1) {
    return apiError("VALIDATION_ERROR", "Invalid hadith number", 400, headers);
  }
  // Arabic is sacred — never editable via API.
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
  const parsed = HadithTranslationPutSchema.safeParse(body);
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
  const ref = db.collection("hadith_entries").doc(`${id}:${number}`);
  const snap = await ref.get();
  if (!snap.exists) {
    return apiError("NOT_FOUND", `Hadith ${id}:${number} not found`, 404, headers);
  }

  const data = snap.data() ?? {};
  const existingTranslations = (data.translations as Record<string, string | undefined>) ?? {};
  const existingEdited = (data.editedTranslations as Record<string, boolean>) ?? {};
  const before = existingTranslations[locale] ?? null;

  await ref.update({
    [`translations.${locale}`]: text,
    [`editedTranslations.${locale}`]: true,
    editedByApi: true,
    lastEditingKeyId: auth.keyId,
    lastEditingKeyName: auth.keyName,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: `apiKey:${auth.keyId}`,
  });
  revalidateHadithCollection(id);

  await writeApiAuditLog({
    actor: { kind: "apiKey", keyId: auth.keyId, keyName: auth.keyName },
    action: "hadith.translation.upsert",
    resourceType: "hadith",
    resourceId: `${id}:${number}`,
    before: { locale, text: before },
    after: { locale, text },
    details: { collection: id, number, locale, hadEditedBefore: Boolean(existingEdited[locale]) },
  });

  return apiOk({ collection: id, number, locale, text }, { headers });
}
