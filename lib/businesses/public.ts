import "server-only";
import { getDb } from "@/lib/firebase/admin";
import { normalizeBusiness } from "@/lib/admin/data/businesses";
import type { Business } from "@/types/business";

export interface PublicListOptions {
  city?: string;
  categoryId?: string;
  limit?: number;
}

export async function listPublished(opts: PublicListOptions = {}): Promise<{
  businesses: Business[];
  source: "firestore" | "unavailable";
}> {
  const limit = opts.limit ?? 200;
  const db = getDb();
  if (!db) return { businesses: [], source: "unavailable" };
  try {
    let q = db
      .collection("businesses")
      .where("status", "==", "published") as FirebaseFirestore.Query;
    if (opts.city) {
      q = q.where("address.city", "==", opts.city);
    }
    if (opts.categoryId) {
      q = q.where("categoryIds", "array-contains", opts.categoryId);
    }
    const snap = await q.orderBy("name", "asc").limit(limit).get();
    const businesses = snap.docs
      .map((d) => normalizeBusiness(d.id, d.data() as Record<string, unknown>))
      .filter((b): b is Business => b !== null);
    return { businesses, source: "firestore" };
  } catch (err) {
    console.warn("[businesses/public] listPublished failed:", err);
    return { businesses: [], source: "unavailable" };
  }
}

export async function getBySlug(slug: string): Promise<Business | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db
      .collection("businesses")
      .where("slug", "==", slug)
      .where("status", "==", "published")
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0]!;
    return normalizeBusiness(doc.id, doc.data() as Record<string, unknown>);
  } catch (err) {
    console.warn("[businesses/public] getBySlug failed:", err);
    return null;
  }
}

export async function listPublishedSlugs(limit = 1000): Promise<Array<{ slug: string; updatedAt: string }>> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db
      .collection("businesses")
      .where("status", "==", "published")
      .select("slug", "updatedAt")
      .limit(limit)
      .get();
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      const slug = typeof data.slug === "string" ? data.slug : "";
      const updatedAtRaw = data.updatedAt;
      let updatedAt: string;
      if (updatedAtRaw && typeof updatedAtRaw === "object" && "toDate" in updatedAtRaw) {
        updatedAt = (updatedAtRaw as { toDate: () => Date }).toDate().toISOString();
      } else if (typeof updatedAtRaw === "string") {
        updatedAt = updatedAtRaw;
      } else {
        updatedAt = new Date().toISOString();
      }
      return { slug, updatedAt };
    }).filter((entry) => entry.slug);
  } catch (err) {
    console.warn("[businesses/public] listPublishedSlugs failed:", err);
    return [];
  }
}
