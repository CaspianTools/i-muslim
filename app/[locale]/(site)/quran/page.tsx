import Link from "next/link";
import { getSurahs } from "@/lib/quran/db";

export const metadata = {
  title: "The Quran — 114 surahs",
  description:
    "Browse all 114 surahs of the Holy Quran with Arabic text and translations.",
};

export default async function QuranIndexPage() {
  const chapters = await getSurahs();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          The Holy Quran
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          114 surahs. Pick one to begin reading.
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {chapters.map((c) => (
          <li key={c.id}>
            <Link
              href={`/quran/${c.id}`}
              className="group flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-accent"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground">
                {c.id}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{c.name_simple}</span>
                  <span
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-lg leading-none text-foreground"
                  >
                    {c.name_arabic}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {c.translated_name.name} · {c.verses_count} verses ·{" "}
                  {c.revelation_place === "makkah" ? "Makkan" : "Madinan"}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
