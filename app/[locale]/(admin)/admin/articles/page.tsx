import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { ArticlesPageClient } from "@/components/admin/articles/ArticlesPageClient";
import { fetchArticles } from "@/lib/admin/data/articles";

export const metadata: Metadata = {
  title: "Articles & Blog",
};

export default async function ArticlesAdminPage() {
  const { items, source } = await fetchArticles();
  return (
    <div>
      <PageHeader
        title="Articles & Blog"
        subtitle={
          source === "firestore"
            ? "Live from Firestore."
            : "Sample data — configure Firebase Admin to manage real articles."
        }
      />
      <ArticlesPageClient initialItems={items} source={source} />
    </div>
  );
}
