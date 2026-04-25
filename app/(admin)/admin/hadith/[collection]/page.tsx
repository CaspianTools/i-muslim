import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCollectionWithHadiths } from "@/lib/admin/data/hadith";
import { HadithList } from "@/components/admin/hadith/HadithList";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminCollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ collection: string }>;
  searchParams: Promise<{ page?: string; book?: string }>;
}) {
  const { collection } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const book = sp.book ? Number(sp.book) : undefined;

  const { collection: meta, entries, total } = await fetchCollectionWithHadiths(
    collection,
    { page, pageSize: PAGE_SIZE, book },
  );
  if (!meta) notFound();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
              {total} hadith · {meta.books.length} books · page {page} of{" "}
              {totalPages}
            </p>
          </div>
          <p dir="rtl" lang="ar" className="font-arabic text-3xl">
            {meta.name_ar}
          </p>
        </div>
      </div>

      <HadithList entries={entries} collection={collection} />

      <nav className="flex items-center justify-between gap-2 text-sm">
        {page > 1 ? (
          <Link
            href={`/admin/hadith/${collection}?page=${page - 1}${book ? `&book=${book}` : ""}`}
            className="rounded-md border border-border bg-background px-3 py-2 hover:border-accent"
          >
            ← Page {page - 1}
          </Link>
        ) : (
          <span />
        )}
        {page < totalPages ? (
          <Link
            href={`/admin/hadith/${collection}?page=${page + 1}${book ? `&book=${book}` : ""}`}
            className="rounded-md border border-border bg-background px-3 py-2 hover:border-accent"
          >
            Page {page + 1} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
