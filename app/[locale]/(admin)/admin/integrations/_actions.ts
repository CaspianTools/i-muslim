"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/permissions/server";
import {
  setGeminiConfig,
  clearGeminiKey,
  GEMINI_MODELS,
  type GeminiConfigStatus,
} from "@/lib/admin/data/secrets";

const geminiConfigSchema = z.object({
  apiKey: z.string().trim().max(500).optional(),
  model: z.enum(GEMINI_MODELS as unknown as [string, ...string[]]),
});

export type UpdateGeminiConfigResult =
  | { ok: true; status: GeminiConfigStatus }
  | { ok: false; error: string };

export async function updateGeminiConfigAction(
  rawInput: unknown,
): Promise<UpdateGeminiConfigResult> {
  const session = await requirePermission("integrations.write");
  const parsed = geminiConfigSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "invalid-input" };
  }
  try {
    const status = await setGeminiConfig(
      {
        apiKey: parsed.data.apiKey ?? null,
        model: parsed.data.model as (typeof GEMINI_MODELS)[number],
      },
      session.email,
    );
    return { ok: true, status };
  } catch (err) {
    console.warn("[admin/integrations/_actions] gemini write failed:", err);
    return { ok: false, error: "write-failed" };
  }
}

export async function clearGeminiKeyAction(): Promise<UpdateGeminiConfigResult> {
  const session = await requirePermission("integrations.write");
  try {
    const status = await clearGeminiKey(session.email);
    return { ok: true, status };
  } catch (err) {
    console.warn("[admin/integrations/_actions] gemini clear failed:", err);
    return { ok: false, error: "write-failed" };
  }
}
