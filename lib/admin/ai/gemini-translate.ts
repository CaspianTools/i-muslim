import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GeminiConfig } from "@/lib/admin/data/secrets";
import { LANG_LABELS, type LangCode } from "@/lib/translations";

// Native name shown in the prompt so the model picks the right script /
// register. Keep aligned with CONTENT_NATIVE in the admin settings UI.
const NATIVE_NAMES: Record<string, string> = {
  en: "English",
  ru: "Russian (Русский)",
  az: "Azerbaijani (Azərbaycanca, Latin script)",
  tr: "Turkish (Türkçe)",
};

export type SacredSourceKind = "hadith" | "ayah";

export type TranslateInput = {
  arabic: string;
  englishContext: string | null;
  targetLang: LangCode;
  sourceKind: SacredSourceKind;
  config: GeminiConfig;
};

export type TranslateResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

function nativeName(lang: LangCode): string {
  return NATIVE_NAMES[lang] ?? LANG_LABELS[lang] ?? lang;
}

function buildPrompt(input: Omit<TranslateInput, "config">): string {
  const target = nativeName(input.targetLang);
  const sourceDescription =
    input.sourceKind === "ayah"
      ? "a verse (ayah) from the Holy Qur'an — the literal, revealed word of Allah"
      : "a hadith — a recorded saying or action of Prophet Muhammad ﷺ";
  const lines = [
    `You are translating ${sourceDescription} for a Muslim companion app.`,
    ``,
    `Target language: ${target}`,
    ``,
    `Strict rules:`,
    `1. Translate the Arabic source faithfully. Preserve meaning exactly. Do not paraphrase, summarize, embellish, or add tafsir / commentary.`,
    `2. Output ONLY the translated text. No preface, no notes, no explanations, no transliteration, no quotation marks around the whole answer.`,
    `3. Do not translate or transliterate the honorific ﷺ (sallallahu alayhi wa sallam) — preserve it as-is when it appears.`,
    `4. Keep proper names (Allah, Prophet Muhammad, companions) in their conventional ${target} form.`,
    `5. Use natural, modern ${target} suitable for a general Muslim reader.`,
    ``,
    `Arabic source:`,
    input.arabic,
  ];
  if (input.englishContext && input.englishContext.trim()) {
    lines.push("", "English reference (for disambiguation only — do NOT translate from this; translate from the Arabic):", input.englishContext.trim());
  }
  lines.push("", `${target} translation:`);
  return lines.join("\n");
}

export async function translateSacredText(
  input: TranslateInput,
): Promise<TranslateResult> {
  if (!input.arabic.trim()) {
    return { ok: false, error: "No Arabic source text to translate." };
  }
  if (input.targetLang === "ar") {
    return { ok: false, error: "Arabic is the original; cannot translate into it." };
  }

  try {
    const client = new GoogleGenerativeAI(input.config.apiKey);
    const model = client.getGenerativeModel({
      model: input.config.model,
      generationConfig: {
        // Low temperature = deterministic, faithful. Sacred text demands this.
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    });
    const result = await model.generateContent(buildPrompt(input));
    const text = result.response.text().trim();
    if (!text) return { ok: false, error: "Gemini returned an empty response." };
    return { ok: true, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Gemini error";
    return { ok: false, error: message };
  }
}
