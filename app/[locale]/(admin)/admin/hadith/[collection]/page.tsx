import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCollectionWithBookStats } from "@/lib/admin/data/hadith";
import { AdminDownloadHadithDialog } from "@/components/admin/hadith/AdminDownloadHadithDialog";

export const dynamic = "force-dynamic";

export default async function AdminCollectionPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = await params;
  const { collection: meta, editedByBook } = await fetchCollectionWithBookStats(
    collection,
  );
  if (!meta) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/admin/hadith"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All collections
        </Link>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{meta.name_en}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {meta.books.length} books · {meta.total} total hadith
            </p>
          </div>
          <p dir="rtl" lang="ar" className="font-arabic text-3xl">
            {meta.name_ar}
          </p>
        </div>
        <div className="mt-3">
          <AdminDownloadHadithDialog
            scope="collection"
            collection={collection}
          />
        </div>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border bg-background">
        {meta.books.map((b) => {
          const editCount = editedByBook[b.number] ?? 0;
          return (
            <li key={b.number}>
              <Link
                href={`/admin/hadith/${collection}/${b.number}`}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground">
                  {b.number}
                </span>
                <span className="flex-1 truncate">{b.name}</span>
                {editCount > 0 ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {editCount} edited
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {b.count} hadith
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
