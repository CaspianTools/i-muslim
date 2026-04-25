import Link from "next/link";
import { getHadithCollections } from "@/lib/hadith/db";

export const metadata = {
  title: "Hadith — Major Collections",
  description:
    "Browse major Sunni hadith collections: Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah, Malik, Nawawi 40, Qudsi 40.",
};

export default async function HadithIndexPage() {
  const collections = await getHadithCollections();

  if (collections.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Hadith Collections
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The hadith database is currently being prepared. Please check back
          soon.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Hadith Collections
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nine major collections. Select one to browse by book.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/hadith/${c.slug}`}
              className="group block rounded-lg border border-border bg-background p-4 transition-colors hover:border-accent"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{c.name_en}</span>
                <span dir="rtl" lang="ar" className="font-arabic text-lg text-foreground">
                  {c.name_ar}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.total} hadith · {c.books.length} books
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
