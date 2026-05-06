"use server";

import { z } from "zod";
import { requirePermissionForLanguage } from "@/lib/permissions/server";
import { requireDb } from "@/lib/firebase/admin";
import { getGeminiConfig } from "@/lib/admin/data/secrets";
import { translateSacredText } from "@/lib/admin/ai/gemini-translate";
import { ALL_LANGS, type LangCode } from "@/lib/translations";

const NON_ARABIC_LANGS = ALL_LANGS.filter((l) => l !== "ar") as [LangCode, ...LangCode[]];

const translateSchema = z.object({
  collection: z.string().min(1).max(64),
  number: z.number().int().positive(),
  targetLang: z.enum(NON_ARABIC_LANGS as unknown as [string, ...string[]]),
});

export type TranslateHadithFieldResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function translateHadithFieldAction(
  rawInput: unknown,
): Promise<TranslateHadithFieldResult> {
  const parsed = translateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  await requirePermissionForLanguage("hadith.translate", parsed.data.targetLang);

  const config = await getGeminiConfig();
  if (!config) {
    return {
      ok: false,
      error: "Gemini API key not configured. Add one in /admin/settings → AI translation.",
    };
  }

  const db = requireDb();
  const id = `${parsed.data.collection}:${parsed.data.number}`;
  const snap = await db.collection("hadith_entries").doc(id).get();
  if (!snap.exists) {
    return { ok: false, error: `Hadith ${id} not found.` };
  }
  const data = snap.data() ?? {};
  const arabic = (data.text_ar as string | undefined) ?? "";
  const translations = (data.translations as Record<string, string | undefined>) ?? {};
  const englishContext = translations.en ?? null;

  return translateSacredText({
    arabic,
    englishContext,
    targetLang: parsed.data.targetLang as LangCode,
    sourceKind: "hadith",
    config,
  });
}
