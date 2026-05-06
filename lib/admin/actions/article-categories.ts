"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { requireDb } from "@/lib/firebase/admin";
import { requirePermission } from "@/lib/permissions/server";
import {
  articleCategoryInputSchema,
  type ArticleCategoryInput,
} from "@/lib/blog/admin-schemas";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const COLLECTION = "articleCategories";

async function authorizeAdmin() {
  await requirePermission("articles.write");
}

function revalidate() {
  revalidatePath("/admin/articles");
  revalidatePath("/admin/articles/categories");
  revalidatePath("/articles");
}

export async function createArticleCategoryAction(
  input: ArticleCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  const parsed = articleCategoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    const dup = await db.collection(COLLECTION).where("slug", "==", parsed.data.slug).limit(1).get();
    if (!dup.empty) return { ok: false, error: `Slug "${parsed.data.slug}" is already in use.` };
    const ref = await db.collection(COLLECTION).add({
      ...parsed.data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidate();
    return { ok: true, data: { id: ref.id } };
  } catch (err) {
    console.warn("[actions/article-categories] create failed:", err);
    return { ok: false, error: "Failed to create category" };
  }
}

export async function updateArticleCategoryAction(
  id: string,
  input: ArticleCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  if (!id) return { ok: false, error: "Missing id" };
  const parsed = articleCategoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    await db.collection(COLLECTION).doc(id).set(
      { ...parsed.data, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    revalidate();
    return { ok: true, data: { id } };
  } catch (err) {
    console.warn("[actions/article-categories] update failed:", err);
    return { ok: false, error: "Failed to update category" };
  }
}

export async function deleteArticleCategoryAction(id: string): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  if (!id) return { ok: false, error: "Missing id" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    await db.collection(COLLECTION).doc(id).delete();
    revalidate();
    return { ok: true, data: { id } };
  } catch (err) {
    console.warn("[actions/article-categories] delete failed:", err);
    return { ok: false, error: "Failed to delete category" };
  }
}
