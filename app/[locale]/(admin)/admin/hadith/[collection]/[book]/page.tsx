import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCollectionWithHadiths } from "@/lib/admin/data/hadith";
import { HadithList } from "@/components/admin/hadith/HadithList";
import { AdminDownloadHadithDialog } from "@/components/admin/hadith/AdminDownloadHadithDialog";
import { AdminUploadHadithDialog } from "@/components/admin/hadith/AdminUploadHadithDialog";
import { getGeminiConfigStatus } from "@/lib/admin/data/secrets";
import { getSiteSession } from "@/lib/auth/session";
import { editableLanguagesFor, hasPermission } from "@/lib/permissions/check";
import { ALL_LANGS } from "@/lib/translations";

export const dynamic = "force-dynamic";

const NON_ARABIC_LANGS = ALL_LANGS.filter((l) => l !== "ar");

export default async function AdminBookPage({
  params,
}: {
  params: Promise<{ collection: string; book: string }>;
}) {
  const { collection, book } = await params;
  const bookNumber = Number(book);
  if (!Number.isInteger(bookNumber) || bookNumber < 1) notFound();

  const [{ collection: meta, entries }, geminiStatus, session] = await Promise.all([
    fetchCollectionWithHadiths(collection, {
      page: 1,
      pageSize: 1000,
      book: bookNumber,
    }),
    getGeminiConfigStatus(),
    getSiteSession(),
  ]);
  if (!meta) notFound();

  const bookMeta = meta.books.find((b) => b.number === bookNumber);
  if (!bookMeta) notFound();

  const permissions = session?.permissions ?? [];
  const editableLanguages = editableLanguagesFor(
    permissions,
    session?.languages,
    "hadith.translate",
    NON_ARABIC_LANGS,
  );
  const canPublish = hasPermission(permissions, "hadith.publish");

  const prev = meta.books.find((b) => b.number === bookNumber - 1);
  const next = meta.books.find((b) => b.number === bookNumber + 1);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/admin/hadith/${collection}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {meta.name_en}
        </Link>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {meta.name_en} · Book {bookNumber}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {bookMeta.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {entries.length} hadith in this book.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <AdminDownloadHadithDialog
            scope="book"
            collection={collection}
            book={bookNumber}
          />
          <AdminUploadHadithDialog collection={collection} />
        </div>
      </div>

      <HadithList
        entries={entries}
        collection={collection}
        aiConfigured={geminiStatus.configured}
        editableLanguages={editableLanguages}
        canPublish={canPublish}
      />

      <nav className="flex items-center justify-between gap-2 text-sm">
        {prev ? (
          <Link
            href={`/admin/hadith/${collection}/${prev.number}`}
            className="rounded-md border border-border bg-background px-3 py-2 hover:border-accent"
          >
            ← Book {prev.number}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/admin/hadith/${collection}/${next.number}`}
            className="rounded-md border border-border bg-background px-3 py-2 hover:border-accent"
          >
            Book {next.number} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
