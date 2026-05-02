"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EditorDialog,
  EditorDialogBody,
  EditorDialogContent,
  EditorDialogDescription,
  EditorDialogFooter,
  EditorDialogHeader,
  EditorDialogTitle,
} from "@/components/ui/editor-dialog";
import { FormGrid } from "@/components/admin/ui/form-layout";
import { toast } from "@/components/ui/sonner";
import {
  SearchableMultiCombobox,
  type SearchableMultiComboboxOption,
} from "@/components/common/SearchableMultiCombobox";
import { LANG_LABELS } from "@/lib/translations";
import type { AdminAyah } from "@/types/admin-content";

const VISIBLE_LANGS_STORAGE_KEY = "i-muslim.admin-quran-visible-langs";
const VISIBLE_LANGS_EVENT = "i-muslim.admin-quran-visible-langs-change";

type FormLang = "en" | "ru";
const QURAN_LANGS: FormLang[] = ["en", "ru"];

function subscribeVisibleLangs(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(VISIBLE_LANGS_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(VISIBLE_LANGS_EVENT, cb);
  };
}

function readVisibleLangsRaw(): string {
  try {
    return window.localStorage.getItem(VISIBLE_LANGS_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function parseVisibleLangs(raw: string): FormLang[] {
  if (!raw) return QURAN_LANGS;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is FormLang => (QURAN_LANGS as string[]).includes(s));
  return parts;
}

const Schema = z.object({
  en: z.string().max(8000),
  ru: z.string().max(8000),
  text_translit: z.string().max(8000),
  notes: z.string().max(4000),
  tags: z.string().max(500),
  published: z.boolean(),
});
type Values = z.infer<typeof Schema>;

export function AyahList({ ayahs, surah }: { ayahs: AdminAyah[]; surah: number }) {
  const [items, setItems] = useState(ayahs);
  const [editing, setEditing] = useState<AdminAyah | null>(null);
  const [filter, setFilter] = useState("");
  const locale = useLocale();
  const tFilter = useTranslations("quranLanguageFilter");

  const visibleLangsRaw = useSyncExternalStore(
    subscribeVisibleLangs,
    readVisibleLangsRaw,
    () => "",
  );
  const visibleLangs = useMemo(() => parseVisibleLangs(visibleLangsRaw), [visibleLangsRaw]);

  const setAndPersistVisibleLangs = useCallback((next: FormLang[]) => {
    try {
      window.localStorage.setItem(VISIBLE_LANGS_STORAGE_KEY, next.join(","));
      window.dispatchEvent(new Event(VISIBLE_LANGS_EVENT));
    } catch {
      // localStorage may be unavailable (private mode, quota); ignore.
    }
  }, []);

  const langOptions: SearchableMultiComboboxOption[] = useMemo(() => {
    const collator = new Intl.Collator(locale, { sensitivity: "base" });
    return QURAN_LANGS
      .map((code) => ({
        value: code,
        label: LANG_LABELS[code] ?? code.toUpperCase(),
      }))
      .sort((a, b) => collator.compare(a.label, b.label));
  }, [locale]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return items;
    const q = filter.toLowerCase();
    return items.filter(
      (a) =>
        String(a.ayah).includes(q) ||
        a.translations.en.toLowerCase().includes(q) ||
        a.translations.ru.toLowerCase().includes(q),
    );
  }, [items, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filter by number or translation…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-md"
        />
        <div className="min-w-[14rem] flex-1">
          <SearchableMultiCombobox
            options={langOptions}
            value={visibleLangs}
            onChange={(next) => setAndPersistVisibleLangs(next as FormLang[])}
            placeholder={tFilter("placeholder")}
            searchPlaceholder={tFilter("searchPlaceholder")}
            emptyText={tFilter("noResults")}
            removeChipLabel={(name) => tFilter("removeChip", { name })}
            moreText={(count) => tFilter("moreItems", { count })}
            ariaLabel={tFilter("label")}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} / {items.length}
        </span>
      </div>

      <div className="space-y-2">
        {filtered.map((a) => (
          <article
            key={a.id}
            className="rounded-lg border border-border bg-background p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums">
                  {a.ayah}
                </span>
                <span className="text-xs text-muted-foreground">
                  Juz {a.juz} · Page {a.page}
                  {a.sajdah && " · Sajdah"}
                </span>
                {a.editedByAdmin && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    edited
                  </span>
                )}
                {!a.published && (
                  <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                    unpublished
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(a)}
                aria-label={`Edit ayah ${a.ayah}`}
              >
                <Pencil /> Edit
              </Button>
            </div>
            <p
              dir="rtl"
              lang="ar"
              className="font-arabic text-2xl leading-loose"
            >
              {a.text_ar}
            </p>
            {a.text_translit && (
              <p className="mt-2 text-sm italic text-muted-foreground">
                {a.text_translit}
              </p>
            )}
            <div className="mt-3 space-y-2 text-sm">
              {QURAN_LANGS.map((lang) => {
                if (!visibleLangs.includes(lang)) return null;
                const text = a.translations[lang];
                if (!text) return null;
                return (
                  <div key={lang}>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {lang.toUpperCase()}
                    </span>
                    <p className="text-foreground">{text}</p>
                  </div>
                );
              })}
            </div>
            {a.notes && (
              <p className="mt-2 rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                Notes: {a.notes}
              </p>
            )}
          </article>
        ))}
      </div>

      <EditAyahDrawer
        surah={surah}
        ayah={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setItems((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          setEditing(null);
        }}
      />
    </div>
  );
}

function EditAyahDrawer({
  surah,
  ayah,
  onClose,
  onSaved,
}: {
  surah: number;
  ayah: AdminAyah | null;
  onClose: () => void;
  onSaved: (a: AdminAyah) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    values: ayah
      ? {
          en: ayah.translations.en,
          ru: ayah.translations.ru,
          text_translit: ayah.text_translit ?? "",
          notes: ayah.notes ?? "",
          tags: ayah.tags.join(", "),
          published: ayah.published,
        }
      : {
          en: "",
          ru: "",
          text_translit: "",
          notes: "",
          tags: "",
          published: true,
        },
    resetOptions: { keepDirtyValues: false },
  });

  async function onSubmit(values: Values) {
    if (!ayah) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/quran/${surah}/${ayah.ayah}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          translations: { en: values.en, ru: values.ru },
          text_translit: values.text_translit || null,
          notes: values.notes || null,
          tags: values.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          published: values.published,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      const updated: AdminAyah = {
        ...ayah,
        translations: { en: values.en, ru: values.ru },
        text_translit: values.text_translit || null,
        notes: values.notes || null,
        tags: values.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        published: values.published,
        editedByAdmin: true,
      };
      onSaved(updated);
      toast.success(`Ayah ${surah}:${ayah.ayah} saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EditorDialog open={Boolean(ayah)} onOpenChange={(o) => !o && onClose()}>
      <EditorDialogContent>
        {ayah && (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex h-full flex-col"
          >
            <EditorDialogHeader>
              <EditorDialogTitle>Edit ayah {surah}:{ayah.ayah}</EditorDialogTitle>
              <EditorDialogDescription>
                Arabic text is read-only. Translations and metadata can be edited.
              </EditorDialogDescription>
            </EditorDialogHeader>
            <EditorDialogBody className="space-y-4">
              <div className="rounded-md bg-muted/40 p-3">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Arabic (read-only)
                </span>
                <p
                  dir="rtl"
                  lang="ar"
                  className="mt-1 font-arabic text-xl leading-loose"
                >
                  {ayah.text_ar}
                </p>
              </div>

              <FormGrid>
                <div className="space-y-1.5">
                  <Label htmlFor="ayah-en">English</Label>
                  <textarea
                    id="ayah-en"
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-background p-2 text-sm"
                    {...form.register("en")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ayah-ru">Russian</Label>
                  <textarea
                    id="ayah-ru"
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-background p-2 text-sm"
                    {...form.register("ru")}
                  />
                </div>
              </FormGrid>
              <div className="space-y-1.5">
                <Label htmlFor="ayah-translit">Transliteration</Label>
                <textarea
                  id="ayah-translit"
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background p-2 text-sm"
                  {...form.register("text_translit")}
                />
              </div>
              <FormGrid>
                <div className="space-y-1.5">
                  <Label htmlFor="ayah-tags">Tags (comma-separated)</Label>
                  <Input id="ayah-tags" {...form.register("tags")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ayah-notes">Internal notes</Label>
                  <textarea
                    id="ayah-notes"
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background p-2 text-sm"
                    {...form.register("notes")}
                  />
                </div>
              </FormGrid>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...form.register("published")}
                  className="size-4"
                />
                Published (visible to public reader)
              </label>
            </EditorDialogBody>

            <EditorDialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={submitting}
              >
                <X /> Cancel
              </Button>
              <Button type="submit" disabled={submitting} aria-busy={submitting}>
                <Save /> {submitting ? "Saving…" : "Save"}
              </Button>
            </EditorDialogFooter>
          </form>
        )}
      </EditorDialogContent>
    </EditorDialog>
  );
}
