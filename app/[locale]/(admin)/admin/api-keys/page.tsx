import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireDb } from "@/lib/firebase/admin";
import { API_KEYS_COLLECTION } from "@/lib/api/auth";
import { ApiKeysPageClient } from "@/components/admin/api-keys/ApiKeysPageClient";
import type { ApiKeyDto } from "@/types/api";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("apiKeys");
  return { title: t("pageTitle") };
}

async function fetchKeys(): Promise<ApiKeyDto[]> {
  const db = requireDb();
  const snap = await db
    .collection(API_KEYS_COLLECTION)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      keyPrefix: data.keyPrefix,
      scopes: data.scopes ?? [],
      permissions: data.permissions ?? [],
      status: data.status,
      createdBy: data.createdBy,
      createdByEmail: data.createdByEmail,
      requestCount: data.requestCount ?? 0,
      lastUsedAt: data.lastUsedAt?.toDate?.()?.toISOString?.() ?? null,
      expiresAt: data.expiresAt?.toDate?.()?.toISOString?.() ?? null,
      revokedAt: data.revokedAt?.toDate?.()?.toISOString?.() ?? null,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
    };
  });
}

export default async function ApiKeysPage() {
  const t = await getTranslations("apiKeys");
  const keys = await fetchKeys();
  return (
    <div>
      <PageHeader title={t("pageTitle")} subtitle={t("subtitle")} />
      <ApiKeysPageClient initialKeys={keys} />
    </div>
  );
}
