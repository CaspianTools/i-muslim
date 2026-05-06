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
import type { AdminHadith } from "@/types/admin-content";
import { LANG_LABELS } from "@/lib/translations";
import { translateHadithFieldAction } from "@/app/[locale]/(admin)/admin/hadith/_actions";

const VISIBLE_LANGS_STORAGE_KEY = "i-muslim.admin-hadith-visible-langs";
const VISIBLE_LANGS_EVENT = "i-muslim.admin-hadith-visible-langs-change";

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

function parseVisibleLangs(raw: string): FormLang[] {
  if (!raw) return NON_ARABIC_LANGS;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is FormLang => (NON_ARABIC_LANGS as string[]).includes(s));
  return parts;
}

// Hardcoded so zod's TS inference picks up each lang field. Keep aligned with
// the non-Arabic subset of ALL_LANGS — the assertion below guards against drift.
const Schema = z.object({
  en: z.string().max(20000),
  ru: z.string().max(20000),
  az: z.string().max(20000),
  tr: z.string().max(20000),
  // Per-language publish flag. Reviewers must explicitly check this for the
  // text to become public — AI drafts and seed loads default to false (Draft).
  publishedEn: z.boolean(),
  publishedRu: z.boolean(),
  publishedAz: z.boolean(),
  publishedTr: z.boolean(),
  narrator: z.string().max(500),
  grade: z.string().max(200),
  notes: z.string().max(4000),
  tags: z.string().max(500),
  published: z.boolean(),
});
type Values = z.infer<typeof Schema>;
type FormLang = "en" | "ru" | "az" | "tr";

const NON_ARABIC_LANGS: FormLang[] = ["en", "ru", "az", "tr"];

const PUBLISHED_KEY: Record<FormLang, "publishedEn" | "publishedRu" | "publishedAz" | "publishedTr"> = {
  en: "publishedEn",
  ru: "publishedRu",
  az: "publishedAz",
  tr: "publishedTr",
};

export function HadithList({
  entries,
  collection,
  aiConfigured,
  editableLanguages,
  canPublish,
}: {
  entries: AdminHadith[];
  collection: string;
  aiConfigured: boolean;
  editableLanguages: string[];
  canPublish: boolean;
}) {
  const [items, setItems] = useState(entries);
  const [editing, setEditing] = useState<AdminHadith | null>(null);
  const [filter, setFilter] = useState("");
  const locale = useLocale();
  const tFilter = useTranslations("quranLanguageFilter");

  // Persist the per-admin "which translations to display" selection in
  // localStorage so it survives reloads. useSyncExternalStore is the
  // codebase's canonical pattern for client-only persisted state (see
  // components/site/hadith/HadithSidebar.tsx) — it sidesteps the
  // setState-in-useEffect issue the React Compiler lint rule flags.
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
    return NON_ARABIC_LANGS
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
      (h) =>
        String(h.number).includes(q) ||
        Object.values(h.translations).some((v) => v?.toLowerCase().includes(q)) ||
        (h.narrator ?? "").toLowerCase().includes(q),
    );
  }, [items, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filter by number, narrator, or text…"
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
        {filtered.map((h) => {
          const draftLangs = NON_ARABIC_LANGS.filter(
            (l) => (h.translations[l] ?? "").trim() && h.publishedTranslations?.[l] !== true,
          );
          return (
          <article
            key={h.id}
            className="rounded-lg border border-border bg-background p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums">
                  #{h.number}
                </span>
                <span className="text-xs text-muted-foreground">Book {h.book}</span>
                {h.grade && (
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                    {h.grade}
                  </span>
                )}
                {h.editedByAdmin && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    edited
                  </span>
                )}
                {!h.published && (
                  <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                    unpublished
                  </span>
                )}
                {draftLangs.length > 0 && (
                  <span
                    className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
                    title={`Draft translations: ${draftLangs.map((l) => l.toUpperCase()).join(", ")}`}
                  >
                    needs review ({draftLangs.length})
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(h)}
                aria-label={`Edit hadith ${h.number}`}
              >
                <Pencil /> Edit
              </Button>
            </div>
            {h.narrator && (
              <p className="mb-2 text-xs italic text-muted-foreground">
                Narrated by {h.narrator}
              </p>
            )}
            <p
              dir="rtl"
              lang="ar"
              className="font-arabic text-xl leading-loose"
            >
              {h.text_ar}
            </p>
            <div className="mt-3 space-y-2 text-sm">
              {NON_ARABIC_LANGS.map((lang) => {
                if (!visibleLangs.includes(lang)) return null;
                const text = h.translations[lang];
                if (!text) return null;
                const isDraft = h.publishedTranslations?.[lang] !== true;
                return (
                  <div key={lang}>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {lang.toUpperCase()}
                      {h.editedTranslations?.[lang] && (
                        <span className="ml-1 text-primary" title="Admin-edited; preserved on re-seed">
                          ✓
                        </span>
                      )}
                      {isDraft ? (
                        <span
                          className="ml-2 rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning"
                          title="Draft — not visible to public reader"
                        >
                          Draft
                        </span>
                      ) : (
                        <span
                          className="ml-2 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success"
                          title="Published — visible to public reader"
                        >
                          Published
                        </span>
                      )}
                    </span>
                    <p className="text-foreground">{text}</p>
                  </div>
                );
              })}
            </div>
            {h.notes && (
              <p className="mt-2 rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                Notes: {h.notes}
              </p>
            )}
          </article>
          );
        })}
      </div>

      <EditHadithDrawer
        collection={collection}
        hadith={editing}
        aiConfigured={aiConfigured}
        editableLanguages={editableLanguages}
        canPublish={canPublish}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setItems((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
          setEditing(null);
        }}
      />
    </div>
  );
}

function buildInitialValues(hadith: AdminHadith | null): Values {
  return {
    en: hadith?.translations.en ?? "",
    ru: hadith?.translations.ru ?? "",
    az: hadith?.translations.az ?? "",
    tr: hadith?.translations.tr ?? "",
    publishedEn: hadith?.publishedTranslations?.en === true,
    publishedRu: hadith?.publishedTranslations?.ru === true,
    publishedAz: hadith?.publishedTranslations?.az === true,
    publishedTr: hadith?.publishedTranslations?.tr === true,
    narrator: hadith?.narrator ?? "",
    grade: hadith?.grade ?? "",
    notes: hadith?.notes ?? "",
    tags: hadith ? hadith.tags.join(", ") : "",
    published: hadith ? hadith.published : true,
  };
}

function EditHadithDrawer({
  collection,
  hadith,
  aiConfigured,
  editableLanguages,
  canPublish,
  onClose,
  onSaved,
}: {
  collection: string;
  hadith: AdminHadith | null;
  aiConfigured: boolean;
  editableLanguages: string[];
  canPublish: boolean;
  onClose: () => void;
  onSaved: (h: AdminHadith) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    values: buildInitialValues(hadith),
  });

  async function onSubmit(values: Values) {
    if (!hadith) return;
    setSubmitting(true);
    try {
      // Send only the translations this user is allowed to write so the
      // backend's per-language gate doesn't reject the request just because
      // an untouched untranslatable lang was included in the payload.
      const translationsPayload: Record<string, string> = {};
      for (const lang of NON_ARABIC_LANGS) {
        if (editableLanguages.includes(lang)) {
          translationsPayload[lang] = values[lang];
        }
      }
      const body: Record<string, unknown> = {
        translations: translationsPayload,
      };
      if (canPublish) {
        const publishedTranslationsPayload: Record<string, boolean> = {};
        for (const lang of NON_ARABIC_LANGS) {
          publishedTranslationsPayload[lang] = values[PUBLISHED_KEY[lang]];
        }
        body.publishedTranslations = publishedTranslationsPayload;
        body.narrator = values.narrator || null;
        body.grade = values.grade || null;
        body.notes = values.notes || null;
        body.tags = values.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        body.published = values.published;
      }
      const res = await fetch(`/api/admin/hadith/${collection}/${hadith.number}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      const editedNext: Record<string, boolean> = { ...hadith.editedTranslations };
      const mergedTranslations: Record<string, string> = { ...hadith.translations };
      for (const lang of NON_ARABIC_LANGS) {
        if (!editableLanguages.includes(lang)) continue;
        mergedTranslations[lang] = translationsPayload[lang] ?? hadith.translations[lang] ?? "";
        if (values[lang] !== (hadith.translations[lang] ?? "")) {
          editedNext[lang] = true;
        }
      }
      const mergedPublishedTranslations: Record<string, boolean> = canPublish
        ? Object.fromEntries(
            NON_ARABIC_LANGS.map((lang) => [lang, values[PUBLISHED_KEY[lang]]]),
          )
        : (hadith.publishedTranslations ?? {});
      const updated: AdminHadith = {
        ...hadith,
        translations: mergedTranslations,
        editedTranslations: editedNext,
        publishedTranslations: mergedPublishedTranslations,
        narrator: canPublish ? values.narrator || null : hadith.narrator,
        grade: canPublish ? values.grade || null : hadith.grade,
        notes: canPublish ? values.notes || null : hadith.notes,
        tags: canPublish
          ? values.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : hadith.tags,
        published: canPublish ? values.published : hadith.published,
        editedByAdmin: true,
      };
      onSaved(updated);
      toast.success(`Hadith ${collection}:${hadith.number} saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EditorDialog open={Boolean(hadith)} onOpenChange={(o) => !o && onClose()}>
      <EditorDialogContent>
        {hadith && (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex h-full flex-col"
          >
            <EditorDialogHeader>
              <EditorDialogTitle>
                Edit hadith {collection} #{hadith.number}
              </EditorDialogTitle>
              <EditorDialogDescription>
                Arabic text is read-only. Translations and metadata can be edited;
                use the AI button to draft a translation, then review before saving.
              </EditorDialogDescription>
            </EditorDialogHeader>
            <EditorDialogBody className="overflow-hidden p-0">
              <div className="grid h-full grid-cols-1 lg:grid-cols-[30%_1fr]">
                <div className="space-y-4 overflow-y-auto p-5 lg:border-e lg:border-border">
                  {!canPublish && (
                    <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
                      Metadata fields are read-only — you don&apos;t have hadith.publish.
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="hadith-narrator">Narrator</Label>
                    <Input id="hadith-narrator" disabled={!canPublish} {...form.register("narrator")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hadith-grade">Grade</Label>
                    <Input id="hadith-grade" disabled={!canPublish} {...form.register("grade")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hadith-tags">Tags (comma-separated)</Label>
                    <Input id="hadith-tags" disabled={!canPublish} {...form.register("tags")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hadith-notes">Internal notes</Label>
                    <textarea
                      id="hadith-notes"
                      rows={4}
                      disabled={!canPublish}
                      className="flex w-full rounded-md border border-input bg-background p-2 text-sm disabled:opacity-50"
                      {...form.register("notes")}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={!canPublish}
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
                      {NON_ARABIC_LANGS.map((lang) => {
                        const editable = editableLanguages.includes(lang);
                        return (
                          <TabsTrigger key={lang} value={lang}>
                            {LANG_LABELS[lang] ?? lang.toUpperCase()}
                            {!editable && (
                              <span className="ms-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                view-only
                              </span>
                            )}
                          </TabsTrigger>
                        );
                      })}
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
                        {hadith.text_ar}
                      </p>
                    </div>
                  </TabsContent>
                  {NON_ARABIC_LANGS.map((lang) => {
                    const editable = editableLanguages.includes(lang);
                    return (
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
                          collection={collection}
                          number={hadith.number}
                          aiConfigured={aiConfigured}
                          editable={editable}
                          canPublish={canPublish}
                          publishedValue={form.watch(PUBLISHED_KEY[lang])}
                          onPublishedChange={(next) =>
                            form.setValue(PUBLISHED_KEY[lang], next, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        />
                      </TabsContent>
                    );
                  })}
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
  collection,
  number,
  aiConfigured,
  editable,
  canPublish,
  publishedValue,
  onPublishedChange,
}: {
  lang: FormLang;
  register: UseFormRegister<Values>;
  setValue: (text: string) => void;
  collection: string;
  number: number;
  aiConfigured: boolean;
  editable: boolean;
  canPublish: boolean;
  publishedValue: boolean;
  onPublishedChange: (next: boolean) => void;
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
      const res = await translateHadithFieldAction({
        collection,
        number,
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
        <Label htmlFor={`hadith-${lang}`} className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
          {!editable && (
            <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              view-only
            </span>
          )}
        </Label>
        <div className="flex items-center gap-2">
          {canPublish && (
            <PublishToggle
              value={publishedValue}
              onChange={onPublishedChange}
              ariaLabel={`Publish status for ${label} translation`}
            />
          )}
          {editable && (
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
          )}
        </div>
      </div>
      <textarea
        id={`hadith-${lang}`}
        readOnly={!editable}
        className="flex h-full min-h-[240px] w-full flex-1 resize-none rounded-md border border-input bg-background p-3 text-sm read-only:opacity-70 read-only:bg-muted/30"
        {...register(lang)}
      />
    </>
  );
}

function PublishToggle({
  value,
  onChange,
  ariaLabel,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  const baseSegment =
    "rounded px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5"
    >
      <button
        type="button"
        role="radio"
        aria-checked={!value}
        onClick={() => onChange(false)}
        className={
          baseSegment +
          (!value
            ? " bg-warning/15 text-warning"
            : " text-muted-foreground hover:text-foreground")
        }
      >
        Draft
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value}
        onClick={() => onChange(true)}
        className={
          baseSegment +
          (value
            ? " bg-success/15 text-success"
            : " text-muted-foreground hover:text-foreground")
        }
      >
        Published
      </button>
    </div>
  );
}
