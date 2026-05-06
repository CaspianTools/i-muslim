"use server";

import { revalidatePath, updateTag } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions/server";
import { requireDb } from "@/lib/firebase/admin";
import type { Permission } from "@/lib/permissions/catalog";
import { LOCALES, type Locale } from "@/i18n/config";
import { CACHE_TAGS } from "@/lib/blog/cache-tags";
import { isValidSlug } from "@/lib/blog/slug";
import { readingMinutes } from "@/lib/blog/reading-time";
import { normalizeArticle } from "@/lib/blog/data";
import type { ArticleStatus } from "@/types/blog";

const COLLECTION = "articles";

const localeEnum = z.enum(LOCALES as unknown as [Locale, ...Locale[]]);

const translationSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z
    .string()
    .trim()
    .max(80)
    .refine((s) => s === "" || isValidSlug(s), "Invalid slug"),
  excerpt: z.string().trim().max(300),
  bodyMd: z.string().max(50_000),
});

const articleInputSchema = z.object({
  category: z
    .string()
    .trim()
    .min(1, "Category is required")
    .max(80)
    .refine((s) => isValidSlug(s), "Invalid category slug"),
  heroImageUrl: z.string().url().or(z.literal("")).nullable().optional(),
  heroImageAlt: z.string().max(200).nullable().optional(),
  translations: z.record(localeEnum, translationSchema).optional(),
});

export type ArticleInput = z.infer<typeof articleInputSchema>;

async function requireSession(perm: Permission = "articles.write") {
  return await requirePermission(perm);
}

function invalidateAll() {
  for (const locale of LOCALES) updateTag(CACHE_TAGS.list(locale));
  updateTag(CACHE_TAGS.slugs());
  revalidatePath("/admin/articles");
  revalidatePath("/articles");
  revalidatePath("/sitemap.xml");
  revalidatePath("/articles/rss.xml");
}

async function ensureSlugUnique(
  db: FirebaseFirestore.Firestore,
  locale: Locale,
  slug: string,
  excludeId?: string,
): Promise<void> {
  if (!slug) return;
  const snap = await db
    .collection(COLLECTION)
    .where(`translations.${locale}.slug`, "==", slug)
    .limit(2)
    .get();
  for (const doc of snap.docs) {
    if (doc.id !== excludeId) {
      throw new Error(`slug-conflict:${locale}:${slug}`);
    }
  }
}

function buildTranslationDoc(input: z.infer<typeof translationSchema>) {
  return {
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    bodyMd: input.bodyMd,
    status: "draft" as ArticleStatus,
    publishedAt: null,
    readingMinutes: readingMinutes(input.bodyMd),
  };
}

export async function createArticle(rawInput: unknown): Promise<{ id: string }> {
  await requireSession();
  const input = articleInputSchema.parse(rawInput);
  const db = requireDb();
  const now = Timestamp.now();

  const translations: Record<string, unknown> = {};
  for (const [locale, t] of Object.entries(input.translations ?? {})) {
    if (!t) continue;
    if (t.slug) {
      await ensureSlugUnique(db, locale as Locale, t.slug);
    }
    translations[locale] = buildTranslationDoc(t);
  }

  const ref = await db.collection(COLLECTION).add({
    category: input.category,
    heroImageUrl: input.heroImageUrl || null,
    heroImageAlt: input.heroImageAlt || null,
    authorId: "fuad",
    translations,
    publishedLocales: [],
    latestPublishedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  invalidateAll();
  return { id: ref.id };
}

export async function updateArticle(id: string, rawInput: unknown): Promise<void> {
  await requireSession();
  const input = articleInputSchema.parse(rawInput);
  const db = requireDb();

  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  if (!snap.exists) throw new Error("not-found");
  const existing = normalizeArticle(snap.id, snap.data() as Record<string, unknown>);

  const translations: Record<string, unknown> = {};
  for (const [locale, t] of Object.entries(input.translations ?? {})) {
    if (!t) continue;
    if (t.slug) {
      await ensureSlugUnique(db, locale as Locale, t.slug, id);
    }
    const prev = existing.translations[locale as Locale];
    translations[locale] = {
      title: t.title,
      slug: t.slug,
      excerpt: t.excerpt,
      bodyMd: t.bodyMd,
      status: prev?.status ?? "draft",
      publishedAt: prev?.publishedAt
        ? Timestamp.fromDate(new Date(prev.publishedAt))
        : null,
      readingMinutes: readingMinutes(t.bodyMd),
    };
  }

  await docRef.update({
    category: input.category,
    heroImageUrl: input.heroImageUrl || null,
    heroImageAlt: input.heroImageAlt || null,
    translations,
    updatedAt: Timestamp.now(),
  });

  invalidateAll();
  updateTag(CACHE_TAGS.post(id));
}

async function setTranslationStatus(
  id: string,
  locale: Locale,
  next: ArticleStatus,
): Promise<void> {
  await requireSession("articles.publish");
  if (!(LOCALES as readonly string[]).includes(locale)) {
    throw new Error("invalid-locale");
  }
  const db = requireDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  if (!snap.exists) throw new Error("not-found");
  const article = normalizeArticle(snap.id, snap.data() as Record<string, unknown>);
  const t = article.translations[locale];
  if (!t) throw new Error("translation-missing");
  if (next === "published" && (!t.title || !t.slug || !t.bodyMd)) {
    throw new Error("incomplete-translation");
  }

  const now = Timestamp.now();
  const newPublishedLocales = new Set(article.publishedLocales);
  if (next === "published") newPublishedLocales.add(locale);
  else newPublishedLocales.delete(locale);

  const publishedLocalesArr = Array.from(newPublishedLocales);

  let latestPublishedAt: Timestamp | null = null;
  for (const loc of publishedLocalesArr) {
    const tr = article.translations[loc];
    if (!tr) continue;
    const candidate =
      loc === locale && next === "published"
        ? now
        : tr.publishedAt
          ? Timestamp.fromDate(new Date(tr.publishedAt))
          : null;
    if (!candidate) continue;
    if (!latestPublishedAt || candidate.toMillis() > latestPublishedAt.toMillis()) {
      latestPublishedAt = candidate;
    }
  }

  await docRef.update({
    [`translations.${locale}.status`]: next,
    [`translations.${locale}.publishedAt`]:
      next === "published" ? now : null,
    publishedLocales: publishedLocalesArr,
    latestPublishedAt,
    updatedAt: now,
  });

  invalidateAll();
  updateTag(CACHE_TAGS.post(id));
}

export async function publishTranslation(id: string, locale: Locale): Promise<void> {
  await setTranslationStatus(id, locale, "published");
}

export async function unpublishTranslation(id: string, locale: Locale): Promise<void> {
  await setTranslationStatus(id, locale, "draft");
}

export async function deleteArticle(id: string): Promise<void> {
  await requireSession();
  const db = requireDb();
  await db.collection(COLLECTION).doc(id).delete();
  invalidateAll();
  updateTag(CACHE_TAGS.post(id));
}

// Re-export to silence tree-shake warnings on FieldValue (not currently used but
// kept for potential future array union ops).
export const _firestoreFieldValue = FieldValue;
