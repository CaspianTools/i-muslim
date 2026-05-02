"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Save, Sparkles, X } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import {
  SearchableMultiCombobox,
  type SearchableMultiComboboxOption,
} from "@/components/common/SearchableMultiCombobox";
import { LANG_LABELS } from "@/lib/translations";
import type { AdminAyah } from "@/types/admin-content";
import { translateAyahFieldAction } from "@/app/[locale]/(admin)/admin/quran/_actions";

const VISIBLE_LANGS_STORAGE_KEY = "i-muslim.admin-quran-visible-langs";
const VISIBLE_LANGS_EVENT = "i-muslim.admin-quran-visible-langs-change";

function subscribeVisibleLangs(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(VISIBLE_LANGS_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(VISIBLE_LANGS_EVENT, cb);
  };
}

// Stable serialized snapshot — useSyncExternalStore compares snapshots by
// reference identity, so we return the persisted string and parse downstream.
function readVisibleLangsRaw(): string {
  try {
    return window.localStorage.getItem(VISIBLE_LANGS_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function parseVisibleLangs(raw: string, availableLangs: string[]): string[] {
  if (!raw) return availableLangs;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => availableLangs.includes(s));
  return parts;
}

// Hardcoded so zod's TS inference picks up each lang field. Keep aligned with
// the non-Arabic subset of ALL_LANGS — the `availableLangs` prop drives which
// of these tabs/inputs are actually rendered, but the schema accepts any.
const Schema = z.object({
  en: z.string().max(8000),
  ru: z.string().max(8000),
  az: z.string().max(8000),
  tr: z.string().max(8000),
  text_translit: z.string().max(8000),
  notes: z.string().max(4000),
  tags: z.string().max(500),
  published: z.boolean(),
});
type Values = z.infer<typeof Schema>;
type FormLang = "en" | "ru" | "az" | "tr";

const NON_ARABIC_LANGS: FormLang[] = ["en", "ru", "az", "tr"];

export function AyahList({
  ayahs,
  surah,
  availableLangs,
  aiConfigured,
}: {
  ayahs: AdminAyah[];
  surah: number;
  availableLangs: string[];
  aiConfigured: boolean;
}) {
  const [items, setItems] = useState(ayahs);
  const [editing, setEditing] = useState<AdminAyah | null>(null);
  const [filter, setFilter] = useState("");
  const locale = useLocale();
  const tFilter = useTranslations("quranLanguageFilter");

  // Editor only ever shows langs that are both supported (FormLang union) and
  // currently activated in /admin/settings → Languages → Qur'an.
  const editableLangs = useMemo<FormLang[]>(
    () => NON_ARABIC_LANGS.filter((l) => availableLangs.includes(l)),
    [availableLangs],
  );

  // Persist the per-admin "which translations to display" selection in
  // localStorage so it survives reloads. Mirrors the pattern used by the
  // hadith admin reader and the public Quran sidebar.
  const visibleLangsRaw = useSyncExternalStore(
    subscribeVisibleLangs,
    readVisibleLangsRaw,
    () => "",
  );
  const visibleLangs = useMemo(
    () => parseVisibleLangs(visibleLangsRaw, availableLangs),
    [visibleLangsRaw, availableLangs],
  );

  const setAndPersistVisibleLangs = useCallback((next: string[]) => {
    try {
      window.localStorage.setItem(VISIBLE_LANGS_STORAGE_KEY, next.join(","));
      window.dispatchEvent(new Event(VISIBLE_LANGS_EVENT));
    } catch {
      // localStorage may be unavailable (private mode, quota); ignore.
    }
  }, []);

  const langOptions: SearchableMultiComboboxOption[] = useMemo(() => {
    const collator = new Intl.Collator(locale, { sensitivity: "base" });
    return availableLangs
      .map((code) => ({
        value: code,
        label: LANG_LABELS[code] ?? code.toUpperCase(),
      }))
      .sort((a, b) => collator.compare(a.label, b.label));
  }, [availableLangs, locale]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return items;
    const q = filter.toLowerCase();
    return items.filter(
      (a) =>
        String(a.ayah).includes(q) ||
        Object.values(a.translations).some((v) => v?.toLowerCase().includes(q)),
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
            onChange={(next) => setAndPersistVisibleLangs(next)}
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
              {availableLangs.map((lang) => {
                if (!visibleLangs.includes(lang)) return null;
                const text = a.translations[lang];
                if (!text) return null;
                return (
                  <div key={lang}>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {lang.toUpperCase()}
                      {a.editedTranslations?.[lang] && (
                        <span className="ml-1 text-primary" title="Admin-edited; preserved on re-seed">
                          ✓
                        </span>
                      )}
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
        editableLangs={editableLangs}
        aiConfigured={aiConfigured}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setItems((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          setEditing(null);
        }}
      />
    </div>
  );
}

function buildInitialValues(ayah: AdminAyah | null): Values {
  return {
    en: ayah?.translations.en ?? "",
    ru: ayah?.translations.ru ?? "",
    az: ayah?.translations.az ?? "",
    tr: ayah?.translations.tr ?? "",
    text_translit: ayah?.text_translit ?? "",
    notes: ayah?.notes ?? "",
    tags: ayah ? ayah.tags.join(", ") : "",
    published: ayah ? ayah.published : true,
  };
}

function EditAyahDrawer({
  surah,
  ayah,
  editableLangs,
  aiConfigured,
  onClose,
  onSaved,
}: {
  surah: number;
  ayah: AdminAyah | null;
  editableLangs: FormLang[];
  aiConfigured: boolean;
  onClose: () => void;
  onSaved: (a: AdminAyah) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    values: buildInitialValues(ayah),
  });

  async function onSubmit(values: Values) {
    if (!ayah) return;
    setSubmitting(true);
    try {
      // Only submit langs the admin can actually edit — disabled langs in
      // settings shouldn't be touched, so the per-language seeder can keep
      // owning them on re-seed.
      const translationsPayload: Record<string, string> = {};
      for (const lang of editableLangs) {
        translationsPayload[lang] = values[lang];
      }
      const res = await fetch(`/api/admin/quran/${surah}/${ayah.ayah}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          translations: translationsPayload,
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

      const mergedTranslations: Record<string, string> = { ...ayah.translations };
      const editedNext: Record<string, boolean> = { ...ayah.editedTranslations };
      for (const lang of editableLangs) {
        mergedTranslations[lang] = values[lang];
        if (values[lang] !== (ayah.translations[lang] ?? "")) {
          editedNext[lang] = true;
        }
      }
      const updated: AdminAyah = {
        ...ayah,
        translations: mergedTranslations,
        editedTranslations: editedNext,
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
                Arabic text is read-only. Translations and metadata can be edited;
                use the AI button to draft a translation, then review before saving.
              </EditorDialogDescription>
            </EditorDialogHeader>
            <EditorDialogBody className="overflow-hidden p-0">
              <div className="grid h-full grid-cols-1 lg:grid-cols-[30%_1fr]">
                <div className="space-y-4 overflow-y-auto p-5 lg:border-e lg:border-border">
                  <div className="space-y-1.5">
                    <Label htmlFor="ayah-translit">Transliteration</Label>
                    <textarea
                      id="ayah-translit"
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background p-2 text-sm"
                      {...form.register("text_translit")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ayah-tags">Tags (comma-separated)</Label>
                    <Input id="ayah-tags" {...form.register("tags")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ayah-notes">Internal notes</Label>
                    <textarea
                      id="ayah-notes"
                      rows={4}
                      className="flex w-full rounded-md border border-input bg-background p-2 text-sm"
                      {...form.register("notes")}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      {...form.register("published")}
                      className="size-4"
                    />
                    Published (visible to public reader)
                  </label>
                </div>

                <Tabs defaultValue="ar" className="flex min-h-0 flex-col p-5">
                  <div className="-mx-5 overflow-x-auto px-5 pb-1">
                    <TabsList>
                      <TabsTrigger value="ar">Arabic</TabsTrigger>
                      {editableLangs.map((lang) => (
                        <TabsTrigger key={lang} value={lang}>
                          {LANG_LABELS[lang] ?? lang.toUpperCase()}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                  <TabsContent value="ar" className="mt-3 flex-1 overflow-y-auto">
                    <div className="rounded-md bg-muted/40 p-4">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        Arabic (read-only)
                      </span>
                      <p
                        dir="rtl"
                        lang="ar"
                        className="mt-2 font-arabic text-lg leading-loose"
                      >
                        {ayah.text_ar}
                      </p>
                    </div>
                  </TabsContent>
                  {editableLangs.map((lang) => (
                    <TabsContent
                      key={lang}
                      value={lang}
                      className="mt-3 flex flex-1 flex-col gap-2"
                    >
                      <TranslationField
                        lang={lang}
                        register={form.register}
                        setValue={(text) =>
                          form.setValue(lang, text, { shouldDirty: true, shouldValidate: true })
                        }
                        surah={surah}
                        ayah={ayah.ayah}
                        aiConfigured={aiConfigured}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
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

function TranslationField({
  lang,
  register,
  setValue,
  surah,
  ayah,
  aiConfigured,
}: {
  lang: FormLang;
  register: UseFormRegister<Values>;
  setValue: (text: string) => void;
  surah: number;
  ayah: number;
  aiConfigured: boolean;
}) {
  const [translating, startTranslate] = useTransition();
  const label = LANG_LABELS[lang] ?? lang;

  function onAiTranslate() {
    if (!aiConfigured) {
      toast.error(
        "Configure a Gemini API key in /admin/settings → AI translation first.",
      );
      return;
    }
    startTranslate(async () => {
      const res = await translateAyahFieldAction({
        surah,
        ayah,
        targetLang: lang,
      });
      if (res.ok) {
        setValue(res.text);
        toast.success(`${label} translation drafted — review before saving.`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`ayah-${lang}`} className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </Label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onAiTranslate}
          disabled={translating}
          aria-busy={translating}
          title={aiConfigured ? `Translate to ${label} with Gemini` : "Configure a Gemini key in /admin/settings first"}
        >
          <Sparkles />
          {translating ? "Translating…" : "Translate with AI"}
        </Button>
      </div>
      <textarea
        id={`ayah-${lang}`}
        className="flex h-full min-h-[240px] w-full flex-1 resize-none rounded-md border border-input bg-background p-3 text-sm"
        {...register(lang)}
      />
    </>
  );
}
