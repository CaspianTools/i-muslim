"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Eye, Save, Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "@/components/ui/sonner";
import { BUNDLED_LOCALES, LOCALE_META, type BundledLocale } from "@/i18n/config";
import { slugify } from "@/lib/blog/slug";
import { readingMinutes } from "@/lib/blog/reading-time";
import { cn } from "@/lib/utils";
import type { Article, ArticleCategoryDoc, CategorySlug } from "@/types/blog";
import {
  createArticle,
  updateArticle,
  publishTranslation,
  unpublishTranslation,
} from "@/app/[locale]/(admin)/admin/articles/_actions";

const EMPTY_TRANSLATION = {
  title: "",
  slug: "",
  excerpt: "",
  bodyMd: "",
};

interface FormState {
  category: CategorySlug;
  heroImageUrl: string;
  heroImageAlt: string;
  translations: Record<BundledLocale, typeof EMPTY_TRANSLATION>;
}

function articleToForm(
  article: Article | null,
  defaultCategory: CategorySlug,
): FormState {
  const base: FormState = {
    category: article?.category ?? defaultCategory,
    heroImageUrl: article?.heroImageUrl ?? "",
    heroImageAlt: article?.heroImageAlt ?? "",
    translations: {
      en: { ...EMPTY_TRANSLATION },
      ar: { ...EMPTY_TRANSLATION },
      tr: { ...EMPTY_TRANSLATION },
      id: { ...EMPTY_TRANSLATION },
    },
  };
  if (article) {
    for (const locale of BUNDLED_LOCALES) {
      const t = article.translations[locale];
      if (!t) continue;
      base.translations[locale] = {
        title: t.title,
        slug: t.slug,
        excerpt: t.excerpt,
        bodyMd: t.bodyMd,
      };
    }
  }
  return base;
}

interface Props {
  article: Article | null;
  source: "firestore" | "mock";
  /** Categories admin can pick from; sourced from the `articleCategories` Firestore collection. */
  categories: ArticleCategoryDoc[];
  /**
   * "page" — sticky footer in the document scroll (standalone editor route).
   * "dialog" — flex-col container with internal scrollable body and a footer
   * pinned outside the scroll area (UAPOP popup).
   */
  layout?: "page" | "dialog";
  /** When provided, called after a successful create instead of routing to the new article's edit page. */
  onSaved?: (result: { id: string }) => void;
  /** When provided, renders a Cancel button in the footer that calls this. */
  onCancel?: () => void;
}

export function ArticleEditorClient({
  article,
  source,
  categories,
  layout = "page",
  onSaved,
  onCancel,
}: Props) {
  const router = useRouter();
  // Named tE, not t: this component already binds `t` to per-locale
  // translation records in articleToForm/buildPayload.
  const tE = useTranslations("articlesAdmin.editor");
  const tCommon = useTranslations("common");
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );
  const defaultCategory: CategorySlug =
    sortedCategories.find((c) => c.isActive)?.slug ?? sortedCategories[0]?.slug ?? "prayer-times";
  const [form, setForm] = useState<FormState>(() => articleToForm(article, defaultCategory));
  const [activeLocale, setActiveLocale] = useState<BundledLocale>("en");
  const [pending, startTransition] = useTransition();
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [view, setView] = useState<"write" | "preview">("write");
  const [localePopoverOpen, setLocalePopoverOpen] = useState(false);

  // Per-locale "user has manually edited the slug" flag. While false, the slug
  // tracks the title on every keystroke. Existing translations start touched so
  // saved slugs aren't clobbered the moment the title is touched.
  const [slugTouched, setSlugTouched] = useState<Record<BundledLocale, boolean>>(() => {
    const seed: Record<BundledLocale, boolean> = { en: false, ar: false, tr: false, id: false };
    if (article) {
      for (const loc of BUNDLED_LOCALES) {
        if (article.translations[loc]?.slug) seed[loc] = true;
      }
    }
    return seed;
  });

  const isMock = source === "mock";
  const isNew = !article;
  const currentTranslation = form.translations[activeLocale];
  const currentStatus = article?.translations[activeLocale]?.status ?? "draft";
  const minutes = readingMinutes(currentTranslation.bodyMd);

  const canSave = useMemo(() => {
    return Object.values(form.translations).some(
      (t) => t.title.trim().length > 0,
    );
  }, [form.translations]);

  useEffect(() => {
    if (view !== "preview") return;
    const ctrl = new AbortController();
    let cancelled = false;
    const id = setTimeout(async () => {
      if (cancelled) return;
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const res = await fetch("/api/admin/articles/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            md: currentTranslation.bodyMd,
            locale: activeLocale,
          }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { html: string };
        if (!cancelled) {
          setPreviewHtml(data.html);
          setPreviewError(null);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (!cancelled) {
          setPreviewHtml("");
          setPreviewError((err as Error).message);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(id);
    };
  }, [view, currentTranslation.bodyMd, activeLocale]);

  function updateTranslation(
    field: keyof typeof EMPTY_TRANSLATION,
    value: string,
  ) {
    setForm((prev) => ({
      ...prev,
      translations: {
        ...prev.translations,
        [activeLocale]: {
          ...prev.translations[activeLocale],
          [field]: value,
        },
      },
    }));
  }

  function handleTitleChange(value: string) {
    setForm((prev) => {
      const t = prev.translations[activeLocale];
      return {
        ...prev,
        translations: {
          ...prev.translations,
          [activeLocale]: {
            ...t,
            title: value,
            slug: slugTouched[activeLocale] ? t.slug : slugify(value),
          },
        },
      };
    });
  }

  function handleSlugChange(value: string) {
    setSlugTouched((prev) => ({ ...prev, [activeLocale]: true }));
    updateTranslation("slug", value);
  }

  function regenerateSlug() {
    setSlugTouched((prev) => ({ ...prev, [activeLocale]: false }));
    updateTranslation("slug", slugify(currentTranslation.title));
  }

  function buildPayload() {
    const translations: Record<string, unknown> = {};
    for (const locale of BUNDLED_LOCALES) {
      const t = form.translations[locale];
      if (!t.title.trim()) continue;
      translations[locale] = {
        title: t.title.trim(),
        slug: t.slug.trim() || slugify(t.title),
        excerpt: t.excerpt.trim(),
        bodyMd: t.bodyMd,
      };
    }
    return {
      category: form.category,
      heroImageUrl: form.heroImageUrl.trim() || null,
      heroImageAlt: form.heroImageAlt.trim() || null,
      translations,
    };
  }

  function handleSave() {
    if (isMock) {
      toast.error(tE("toastConfigureFirebase"));
      return;
    }
    if (!canSave) {
      toast.error(tE("toastNeedTranslation"));
      return;
    }
    const payload = buildPayload();
    startTransition(async () => {
      try {
        if (isNew) {
          const { id } = await createArticle(payload);
          toast.success(tE("toastCreated"));
          if (onSaved) {
            onSaved({ id });
          } else {
            router.push(`/admin/articles/${id}`);
          }
        } else {
          await updateArticle(article!.id, payload);
          toast.success(tE("toastSaved"));
          router.refresh();
        }
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.startsWith("slug-conflict:")) {
          const [, locale, slug] = msg.split(":");
          toast.error(
            tE("toastSlugConflict", { slug, locale: locale.toUpperCase() }),
          );
        } else {
          toast.error(tE("toastSaveFailed", { error: msg }));
        }
      }
    });
  }

  function handlePublish() {
    if (isMock || isNew) {
      toast.error(tE("toastSaveFirst"));
      return;
    }
    startTransition(async () => {
      try {
        await publishTranslation(article!.id, activeLocale);
        toast.success(tE("toastPublished", { locale: activeLocale.toUpperCase() }));
        router.refresh();
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "incomplete-translation") {
          toast.error(tE("toastIncomplete"));
        } else {
          toast.error(tE("toastPublishFailed", { error: msg }));
        }
      }
    });
  }

  function handleUnpublish() {
    if (isMock || isNew) return;
    startTransition(async () => {
      try {
        await unpublishTranslation(article!.id, activeLocale);
        toast.success(
          tE("toastUnpublished", { locale: activeLocale.toUpperCase() }),
        );
        router.refresh();
      } catch (err) {
        toast.error(tE("toastUnpublishFailed", { error: (err as Error).message }));
      }
    });
  }

  const localeOptions = useMemo(
    () =>
      BUNDLED_LOCALES.map((loc) => ({
        code: loc,
        englishName: LOCALE_META[loc].englishName,
        nativeName: LOCALE_META[loc].nativeName,
        hasContent: form.translations[loc].title.trim().length > 0,
      })),
    [form.translations],
  );

  const localePicker = (
    <div className="flex items-center gap-2">
      <Label
        htmlFor="article-locale"
        className="text-xs uppercase tracking-wide text-muted-foreground"
      >
        {tE("translation")}
      </Label>
      <Popover open={localePopoverOpen} onOpenChange={setLocalePopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id="article-locale"
            aria-haspopup="listbox"
            aria-expanded={localePopoverOpen}
            className="flex h-9 min-w-[220px] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-2 truncate">
              <span className="font-mono text-xs uppercase text-muted-foreground">
                {activeLocale}
              </span>
              <span className="truncate">
                {LOCALE_META[activeLocale].englishName}
              </span>
              {form.translations[activeLocale].title.trim().length > 0 && (
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
              )}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder={tE("searchLanguage")} />
            <CommandList>
              <CommandEmpty>{tE("noMatches")}</CommandEmpty>
              {localeOptions.map((opt) => {
                const isSelected = opt.code === activeLocale;
                return (
                  <CommandItem
                    key={opt.code}
                    value={`${opt.code} ${opt.englishName} ${opt.nativeName}`}
                    onSelect={() => {
                      setActiveLocale(opt.code);
                      setLocalePopoverOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-2 py-2",
                      isSelected && "ui-selected",
                    )}
                  >
                    <span className="font-mono text-xs uppercase text-muted-foreground w-7 shrink-0">
                      {opt.code}
                    </span>
                    <span className="flex-1 truncate">
                      {opt.englishName}
                      <span className="ms-1 text-muted-foreground">
                        · {opt.nativeName}
                      </span>
                    </span>
                    {opt.hasContent && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                    <Check
                      className={cn(
                        "size-4 ml-1 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );

  const body = (
    <div className="space-y-4">
      {localePicker}

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <div>
            <Label htmlFor="category">{tE("category")}</Label>
            <select
              id="category"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={form.category}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, category: e.target.value }))
              }
            >
              {sortedCategories.length === 0 && (
                <option value={form.category}>{form.category}</option>
              )}
              {sortedCategories.map((c) => (
                <option key={c.slug} value={c.slug} disabled={!c.isActive}>
                  {c.name.en}
                  {!c.isActive ? ` ${tE("categoryInactive")}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="hero-url">{tE("heroUrl")}</Label>
            <Input
              id="hero-url"
              placeholder="https://images.unsplash.com/…"
              value={form.heroImageUrl}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, heroImageUrl: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="hero-alt">{tE("heroAlt")}</Label>
            <Input
              id="hero-alt"
              value={form.heroImageAlt}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, heroImageAlt: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor={`slug-${activeLocale}`}>
              {tE("slug", { locale: activeLocale.toUpperCase() })}
            </Label>
            <div className="mt-1 flex gap-2">
              <Input
                id={`slug-${activeLocale}`}
                value={currentTranslation.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder={tE("slugPlaceholder")}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={regenerateSlug}
                aria-label={tE("regenerateSlug")}
                title={tE("regenerateSlug")}
              >
                <Undo2 />
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor={`excerpt-${activeLocale}`}>
              {tE("excerpt")}
            </Label>
            <textarea
              id={`excerpt-${activeLocale}`}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              maxLength={300}
              value={currentTranslation.excerpt}
              onChange={(e) => updateTranslation("excerpt", e.target.value)}
            />
          </div>
        </aside>

        <div className="space-y-4">
          <div>
            <Label htmlFor={`title-${activeLocale}`}>{tE("title")}</Label>
            <Input
              id={`title-${activeLocale}`}
              value={currentTranslation.title}
              onChange={(e) => handleTitleChange(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="inline-flex rounded-md border border-border p-0.5 text-sm">
              <button
                type="button"
                className={`px-3 py-1 rounded ${view === "write" ? "bg-muted" : ""}`}
                onClick={() => setView("write")}
              >
                {tE("write")}
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded ${view === "preview" ? "bg-muted" : ""}`}
                onClick={() => setView("preview")}
              >
                <Eye className="inline size-3.5 me-1" /> {tE("preview")}
              </button>
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {tE("charsAndReadingTime", {
                chars: currentTranslation.bodyMd.length,
                minutes,
              })}
            </div>
          </div>

          {view === "write" ? (
            <textarea
              className="min-h-[420px] w-full rounded-md border border-input bg-background p-3 font-mono text-sm"
              placeholder={tE("bodyPlaceholder")}
              value={currentTranslation.bodyMd}
              onChange={(e) => updateTranslation("bodyMd", e.target.value)}
            />
          ) : (
            <div className="min-h-[420px] rounded-md border border-border bg-card p-4">
              {previewLoading ? (
                <div className="text-sm text-muted-foreground">{tE("rendering")}</div>
              ) : previewError ? (
                <div className="text-sm text-danger">
                  {tE("previewFailed", { error: previewError })}
                </div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-xs text-muted-foreground">
        {isNew
          ? tE("newArticle")
          : tE("statusLine", {
              locale: activeLocale.toUpperCase(),
              status: currentStatus,
            })}
        {isMock && ` · ${tE("mockMode")}`}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={pending}
          >
            {tCommon("cancel")}
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={handleSave}
          disabled={pending || isMock || !canSave}
        >
          <Save />{" "}
          {pending ? tE("saving") : isNew ? tE("createDraft") : tCommon("save")}
        </Button>
        {!isNew && currentStatus === "published" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={handleUnpublish}
            disabled={pending || isMock}
          >
            {tE("unpublish", { locale: activeLocale.toUpperCase() })}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handlePublish}
            disabled={pending || isMock || isNew}
          >
            <Send /> {tE("publish", { locale: activeLocale.toUpperCase() })}
          </Button>
        )}
      </div>
    </div>
  );

  if (layout === "dialog") {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{body}</div>
        <div className="border-t border-border bg-background px-5 py-3">
          {footer}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {body}
      <div className="sticky bottom-0 -mx-4 md:-mx-8 border-t border-border bg-background/95 px-4 md:px-8 py-3 backdrop-blur">
        {footer}
      </div>
    </div>
  );
}
