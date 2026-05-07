import "server-only";
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";
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
      // Sacred-text input is canonical, not user-generated, and legitimately
      // mentions warfare, hudud, marriage, etc. Keep only HIGH-confidence blocks
      // to avoid false positives. (RECITATION is a separate filter, unaffected.)
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ],
    });
    const result = await model.generateContent(buildPrompt(input));
    const text = result.response.text().trim();
    if (text) return { ok: true, text };

    const promptFeedback = result.response.promptFeedback;
    const candidate = result.response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const safetyRatings = candidate?.safetyRatings;

    console.error("[gemini-translate] empty response", {
      targetLang: input.targetLang,
      sourceKind: input.sourceKind,
      model: input.config.model,
      promptFeedback,
      finishReason,
      safetyRatings,
    });

    if (promptFeedback?.blockReason) {
      return {
        ok: false,
        error: `Gemini blocked the prompt (${promptFeedback.blockReason}). Try a different model in /admin/settings.`,
      };
    }
    if (finishReason === "RECITATION") {
      return {
        ok: false,
        error:
          "Gemini blocked the response as a possible recitation of training data. Try a different model (e.g. gemini-2.5-pro) in /admin/settings, or translate this entry manually.",
      };
    }
    if (finishReason === "SAFETY") {
      const flagged = safetyRatings
        ?.filter((r) => r.probability !== "NEGLIGIBLE" && r.probability !== "HARM_PROBABILITY_UNSPECIFIED")
        .map((r) => `${r.category}=${r.probability}`)
        .join(", ");
      return {
        ok: false,
        error: `Gemini's safety filter blocked the response${flagged ? ` (${flagged})` : ""}. Try a different model in /admin/settings.`,
      };
    }
    if (finishReason === "MAX_TOKENS") {
      return {
        ok: false,
        error: "Gemini hit the output token limit before finishing. Try again or use a shorter source.",
      };
    }
    if (finishReason && finishReason !== "STOP") {
      return {
        ok: false,
        error: `Gemini returned no candidates (finishReason: ${finishReason}).`,
      };
    }
    return { ok: false, error: "Gemini returned an empty response." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Gemini error";
    return { ok: false, error: message };
  }
}
