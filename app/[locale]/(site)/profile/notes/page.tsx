import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSiteSession } from "@/lib/auth/session";
import { listNotes } from "@/lib/profile/notes-data";
import { ProfileNoteRow } from "@/components/site/notes/ProfileNoteRow";
import {
  NOTE_ITEM_TYPES,
  isNoteItemType,
  type NoteItemType,
} from "@/types/notes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profileNotes");
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

const TAB_KEYS: ReadonlyArray<"all" | NoteItemType> = ["all", ...NOTE_ITEM_TYPES];

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await getSiteSession();
  if (!session) redirect("/login?callbackUrl=/profile/notes");

  const sp = await searchParams;
  const activeType: NoteItemType | null = isNoteItemType(sp.type) ? sp.type : null;
  const t = await getTranslations("profileNotes");
  const tNav = await getTranslations("profileNav");

  const notes = await listNotes(session.uid, {
    itemType: activeType ?? undefined,
    limit: 100,
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {tNav("items.notes")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("pageDescription")}</p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {TAB_KEYS.map((key) => {
          const isActive =
            (activeType === null && key === "all") || activeType === key;
          const href =
            key === "all" ? "/profile/notes" : `/profile/notes?type=${key}`;
          return (
            <Link
              key={key}
              href={href}
              className={
                "inline-flex items-center rounded-md px-3 py-1.5 text-sm transition-colors " +
                (isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              {t(`tabs.${key}` as `tabs.${typeof key}`)}
            </Link>
          );
        })}
      </nav>

      {notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <ProfileNoteRow key={note.id} note={note} />
          ))}
        </ul>
      )}
    </div>
  );
}
