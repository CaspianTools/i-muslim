import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ArticleEditorClient } from "@/components/admin/articles/ArticleEditorClient";
import { getFirebaseAdminStatus } from "@/lib/firebase/admin";

export const metadata: Metadata = {
  title: "New article",
};

export default function NewArticlePage() {
  const status = getFirebaseAdminStatus();
  return (
    <div>
      <PageHeader
        title="New article"
        subtitle="Draft a new article. Publish per locale once each translation is ready."
      />
      <Link
        href="/admin/articles"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to articles
      </Link>
      <ArticleEditorClient
        article={null}
        source={status.configured ? "firestore" : "mock"}
      />
    </div>
  );
}
