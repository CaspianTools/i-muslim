import Link from "next/link";
import { fetchCollections } from "@/lib/admin/data/hadith";

export const dynamic = "force-dynamic";

export default async function AdminHadithPage() {
  const { collections, source } = await fetchCollections();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hadith</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {source === "empty"
            ? "Database is empty. Run npm run seed:hadith to populate."
            : `${collections.length} collections.`}
        </p>
      </div>

      {source === "empty" ? (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-medium">No Hadith data found in Firestore.</p>
          <p className="mt-1 text-muted-foreground">Run:</p>
          <pre className="mt-2 rounded-md bg-muted/40 p-2 font-mono text-xs">npm run seed:hadith</pre>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/admin/hadith/${c.slug}`}
                className="group block rounded-lg border border-border bg-background p-4 transition-colors hover:border-accent"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{c.name_en}</span>
                  <span dir="rtl" lang="ar" className="font-arabic text-lg">
                    {c.name_ar}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.total} hadith · {c.books.length} books</span>
                  {c.edited_count && c.edited_count > 0 ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                      {c.edited_count} edited
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
