import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ArticleEditorClient } from "@/components/admin/articles/ArticleEditorClient";
import { fetchArticleById } from "@/lib/admin/data/articles";
import { fetchArticleCategories } from "@/lib/admin/data/article-categories";
import { getFirebaseAdminStatus } from "@/lib/firebase/admin";
import { getSiteSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/check";

export const metadata: Metadata = {
  title: "Edit article",
};

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // The Edit affordances are hidden for non-writers, but the editor is also
  // reachable by direct URL (a Translator has articles.read) — gate the page
  // itself. No admin error boundary exists, so redirect to the dashboard.
  const session = await getSiteSession();
  const locale = await getLocale();
  if (!session || !hasPermission(session.permissions, "articles.write")) {
    redirect(`/${locale}/admin`);
  }
  const status = getFirebaseAdminStatus();
  if (!status.configured) {
    return (
      <div>
        <PageHeader title="Edit article" />
        <div className="rounded-md border border-warning/30 bg-warning/5 p-4 text-sm">
          Firebase Admin is not configured. Set the env vars and restart.
        </div>
      </div>
    );
  }
  const [article, { categories }] = await Promise.all([
    fetchArticleById(id),
    fetchArticleCategories(),
  ]);
  if (!article) notFound();
  const title =
    article.translations.en?.title ||
    Object.values(article.translations).find((t) => t)?.title ||
    "Untitled article";
  return (
    <div>
      <PageHeader
        title={title}
        subtitle="Edit translations and publish per locale."
      />
      <Link
        href="/admin/articles"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to articles
      </Link>
      <ArticleEditorClient
        article={article}
        source="firestore"
        categories={categories}
      />
    </div>
  );
}
