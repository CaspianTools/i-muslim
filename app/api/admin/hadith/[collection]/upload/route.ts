import { NextResponse } from "next/server";
import {
  requirePermission,
  requirePermissionForLanguage,
  badRequest,
  serverError,
} from "@/lib/admin/api";
import { hasPermission } from "@/lib/permissions/check";
import { requireDb } from "@/lib/firebase/admin";
import { revalidateHadithCollection } from "@/lib/hadith/db";
import {
  ImportValidationError,
  mergeHadithExport,
} from "@/lib/hadith/import";
import { ALL_LANGS } from "@/lib/translations";

export const runtime = "nodejs";

const NON_ARABIC_LANGS = ALL_LANGS.filter((l) => l !== "ar");

const ALLOWED_COLLECTIONS = new Set([
  "bukhari", "muslim", "abudawud", "tirmidhi", "nasai",
  "ibnmajah", "malik", "nawawi", "qudsi",
]);

const MAX_BODY_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(
  req: Request,
  ctx: { params: Promise<{ collection: string }> },
) {
  // Read access is the floor — everyone who can hit this endpoint must at
  // least be allowed to view the collection.
  const auth = await requirePermission("hadith.read");
  if (!auth.ok) return auth.response;

  const { collection } = await ctx.params;
  if (!ALLOWED_COLLECTIONS.has(collection)) {
    return badRequest("Invalid collection");
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: `Payload exceeds ${MAX_BODY_BYTES} bytes` },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  // Pull `lang` early so we can run the per-language permission check before
  // touching Firestore. The full schema validation happens inside merge().
  const lang =
    body && typeof body === "object" && "lang" in body
      ? String((body as { lang: unknown }).lang)
      : null;
  if (!lang) return badRequest("Missing `lang` in payload");

  if (lang === "all") {
    // Need translate permission for every language that actually carries text
    // in this payload. Languages with no incoming text don't need a check.
    const incomingLangs = collectIncomingLangs(body);
    for (const code of incomingLangs) {
      const langAuth = await requirePermissionForLanguage(
        "hadith.translate",
        code,
      );
      if (!langAuth.ok) return langAuth.response;
    }
  } else {
    if (!(ALL_LANGS as readonly string[]).includes(lang)) {
      return badRequest(`Unknown language code "${lang}"`);
    }
    if (lang === "ar") {
      return badRequest(
        "Arabic is the original sacred text, not a translation target.",
      );
    }
    const langAuth = await requirePermissionForLanguage(
      "hadith.translate",
      lang,
    );
    if (!langAuth.ok) return langAuth.response;
  }

  const canPublish = hasPermission(auth.session.permissions, "hadith.publish");

  try {
    const db = requireDb();
    const result = await mergeHadithExport(db, body, {
      actorEmail: auth.session.email ?? null,
      canPublish,
      expectedCollection: collection,
    });
    revalidateHadithCollection(collection);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ImportValidationError) {
      return NextResponse.json(
        { error: err.message, issues: err.issues },
        { status: 400 },
      );
    }
    return serverError("Failed to import hadith translations", err);
  }
}

/**
 * Walk the payload and collect the set of language codes that carry at least
 * one non-empty translation string. Used so we only check `hadith.translate`
 * for languages the upload actually touches.
 */
function collectIncomingLangs(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const arr = (body as { hadith?: unknown }).hadith;
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") continue;
    const t = (entry as { translations?: unknown }).translations;
    if (!t || typeof t !== "object") continue;
    for (const code of NON_ARABIC_LANGS) {
      const text = (t as Record<string, unknown>)[code];
      if (typeof text === "string" && text.length > 0) seen.add(code);
    }
  }
  return Array.from(seen);
}
