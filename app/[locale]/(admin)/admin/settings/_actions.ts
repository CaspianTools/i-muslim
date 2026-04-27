"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { LOCALES, type Locale } from "@/i18n/config";
import { ALL_LANGS, type LangCode } from "@/lib/translations";
import {
  setLanguageSettings,
  type LanguageSettings,
} from "@/lib/admin/data/language-settings";

const inputSchema = z.object({
  uiEnabled: z.array(z.enum(LOCALES as unknown as [Locale, ...Locale[]])),
  contentEnabled: z.array(
    z.enum(ALL_LANGS as unknown as [LangCode, ...LangCode[]]),
  ),
});

export type UpdateLanguageSettingsResult =
  | { ok: true; settings: LanguageSettings }
  | { ok: false; error: string };

export async function updateLanguageSettings(
  rawInput: unknown,
): Promise<UpdateLanguageSettingsResult> {
  const session = await requireAdminSession();
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "invalid-input" };
  }
  try {
    const settings = await setLanguageSettings(parsed.data, session.email);
    // Public footer + Quran/Hadith pages read this — invalidate broadly.
    revalidatePath("/", "layout");
    return { ok: true, settings };
  } catch (err) {
    console.warn("[admin/settings/_actions] write failed:", err);
    return { ok: false, error: "write-failed" };
  }
}
