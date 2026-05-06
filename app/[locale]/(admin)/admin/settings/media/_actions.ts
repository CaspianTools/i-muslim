"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions/server";
import {
  createSiteUploadUrl,
  deleteSiteStorageObject,
  type SiteUploadInput,
  type SiteUploadKind,
} from "@/lib/site-config/storage";
import {
  setSiteAsset,
  type SiteConfig,
} from "@/lib/admin/data/site-config";

const KIND_VALUES = ["logo", "favicon", "og", "articlePlaceholder"] as const;

export async function getSiteUploadUrlAction(
  input: SiteUploadInput,
): Promise<
  | { ok: true; data: { url: string; storagePath: string; expiresAt: string } }
  | { ok: false; error: string }
> {
  try {
    await requirePermission("settings.write");
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  try {
    const result = await createSiteUploadUrl(input);
    return { ok: true, data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create upload URL";
    return { ok: false, error: msg };
  }
}

export async function deleteSiteAssetAction(
  storagePath: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("settings.write");
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  if (!storagePath) return { ok: false, error: "missing_path" };
  await deleteSiteStorageObject(storagePath);
  return { ok: true };
}

const updateAssetSchema = z.object({
  kind: z.enum(KIND_VALUES as unknown as [SiteUploadKind, ...SiteUploadKind[]]),
  storagePath: z.string().nullable(),
});

export type UpdateSiteAssetResult =
  | { ok: true; config: SiteConfig }
  | { ok: false; error: string };

export async function updateSiteAssetAction(
  rawInput: unknown,
): Promise<UpdateSiteAssetResult> {
  let session;
  try {
    session = await requirePermission("settings.write");
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = updateAssetSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "invalid-input" };
  }
  try {
    const config = await setSiteAsset(parsed.data, session.email);
    // Favicon, logo, OG, article placeholder all read across the public site
    // and admin layouts — invalidate broadly so changes show up everywhere.
    revalidatePath("/", "layout");
    return { ok: true, config };
  } catch (err) {
    console.warn("[admin/settings/media/_actions] write failed:", err);
    return { ok: false, error: "write-failed" };
  }
}
