"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Save, Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { LOCALES, type Locale } from "@/i18n/config";
import { CATEGORY_SLUGS } from "@/lib/blog/taxonomy";
import { slugify } from "@/lib/blog/slug";
import { readingMinutes } from "@/lib/blog/reading-time";
import type { Article, CategorySlug } from "@/types/blog";
import {
  createArticle,
  updateArticle,
  publishTranslation,
  unpublishTranslation,
} from "@/app/[locale]/(admin)/admin/articles/_actions";

const CATEGORY_LABELS: Record<CategorySlug, string> = {
  "prayer-times": "Prayer Times",
  hijri: "Hijri",
  "quran-hadith": "Quran & Hadith",
  qibla: "Qibla",
};

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
  translations: Record<Locale, typeof EMPTY_TRANSLATION>;
}

function articleToForm(article: Article | null): FormState {
  const base: FormState = {
    category: article?.category ?? "prayer-times",
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
    for (const locale of LOCALES) {
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
}

export function ArticleEditorClient({ article, source }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => articleToForm(article));
  const [activeLocale, setActiveLocale] = useState<Locale>("en");
  const [pending, startTransition] = useTransition();
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [view, setView] = useState<"write" | "preview">("write");
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
        if (!cancelled) setPreviewHtml(data.html);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (!cancelled) {
          setPreviewHtml(
            `<div class="text-sm text-danger">Preview failed: ${(err as Error).message}</div>`,
          );
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

  function autoSlugFromTitle() {
    const next = slugify(currentTranslation.title);
    updateTranslation("slug", next);
  }

  function buildPayload() {
    const translations: Record<string, unknown> = {};
    for (const locale of LOCALES) {
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
      toast.error("Configure Firebase Admin to save articles.");
      return;
    }
    if (!canSave) {
      toast.error("Add at least one translation with a title.");
      return;
    }
    const payload = buildPayload();
    startTransition(async () => {
      try {
        if (isNew) {
          const { id } = await createArticle(payload);
          toast.success("Article created.");
          router.push(`/admin/articles/${id}`);
        } else {
          await updateArticle(article!.id, payload);
          toast.success("Article saved.");
          router.refresh();
        }
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.startsWith("slug-conflict:")) {
          const [, locale, slug] = msg.split(":");
          toast.error(`Slug "${slug}" is already used in ${locale.toUpperCase()}.`);
        } else {
          toast.error(`Save failed: ${msg}`);
        }
      }
    });
  }

  function handlePublish() {
    if (isMock || isNew) {
      toast.error("Save the article first.");
      return;
    }
    startTransition(async () => {
      try {
        await publishTranslation(article!.id, activeLocale);
        toast.success(`Published (${activeLocale.toUpperCase()}).`);
        router.refresh();
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "incomplete-translation") {
          toast.error("Add a title, slug, and body before publishing.");
        } else {
          toast.error(`Publish failed: ${msg}`);
        }
      }
    });
  }

  function handleUnpublish() {
    if (isMock || isNew) return;
    startTransition(async () => {
      try {
        await unpublishTranslation(article!.id, activeLocale);
        toast.success(`Unpublished (${activeLocale.toUpperCase()}).`);
        router.refresh();
      } catch (err) {
        toast.error(`Unpublish failed: ${(err as Error).message}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-64">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={form.category}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, category: e.target.value as CategorySlug }))
            }
          >
            {CATEGORY_SLUGS.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-64">
          <Label htmlFor="hero-url">Hero image URL (optional)</Label>
          <Input
            id="hero-url"
            placeholder="https://images.unsplash.com/…"
            value={form.heroImageUrl}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, heroImageUrl: e.target.value }))
            }
          />
        </div>
        <div className="flex-1 min-w-64">
          <Label htmlFor="hero-alt">Hero alt text</Label>
          <Input
            id="hero-alt"
            value={form.heroImageAlt}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, heroImageAlt: e.target.value }))
            }
          />
        </div>
      </div>

      <Tabs value={activeLocale} onValueChange={(v) => setActiveLocale(v as Locale)}>
        <TabsList>
          {LOCALES.map((loc) => {
            const has = form.translations[loc].title.trim().length > 0;
            return (
              <TabsTrigger key={loc} value={loc}>
                <span className="uppercase">{loc}</span>
                {has && <span className="ms-1 size-1.5 rounded-full bg-primary inline-block" />}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {LOCALES.map((loc) => (
          <TabsContent key={loc} value={loc} className="space-y-4 pt-4">
            <div>
              <Label htmlFor={`title-${loc}`}>Title</Label>
              <Input
                id={`title-${loc}`}
                value={form.translations[loc].title}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    translations: {
                      ...prev.translations,
                      [loc]: { ...prev.translations[loc], title: e.target.value },
                    },
                  }))
                }
                onBlur={() => {
                  if (!form.translations[loc].slug && form.translations[loc].title) {
                    setForm((prev) => ({
                      ...prev,
                      translations: {
                        ...prev.translations,
                        [loc]: {
                          ...prev.translations[loc],
                          slug: slugify(prev.translations[loc].title),
                        },
                      },
                    }));
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor={`slug-${loc}`}>Slug</Label>
                <Input
                  id={`slug-${loc}`}
                  value={form.translations[loc].slug}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      translations: {
                        ...prev.translations,
                        [loc]: {
                          ...prev.translations[loc],
                          slug: e.target.value,
                        },
                      },
                    }))
                  }
                  placeholder="auto-generated from title"
                />
              </div>
              <div className="self-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (loc !== activeLocale) setActiveLocale(loc);
                    autoSlugFromTitle();
                  }}
                >
                  <Undo2 /> Regenerate
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor={`excerpt-${loc}`}>Excerpt (≤ 200 chars)</Label>
              <textarea
                id={`excerpt-${loc}`}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={2}
                maxLength={300}
                value={form.translations[loc].excerpt}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    translations: {
                      ...prev.translations,
                      [loc]: {
                        ...prev.translations[loc],
                        excerpt: e.target.value,
                      },
                    },
                  }))
                }
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-md border border-border p-0.5 text-sm">
          <button
            type="button"
            className={`px-3 py-1 rounded ${view === "write" ? "bg-muted" : ""}`}
            onClick={() => setView("write")}
          >
            Write
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded ${view === "preview" ? "bg-muted" : ""}`}
            onClick={() => setView("preview")}
          >
            <Eye className="inline size-3.5 me-1" /> Preview
          </button>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {currentTranslation.bodyMd.length} chars · ~{minutes} min read
        </div>
      </div>

      {view === "write" ? (
        <textarea
          className="min-h-[420px] w-full rounded-md border border-input bg-background p-3 font-mono text-sm"
          placeholder="Write Markdown here. # Heading, **bold**, [link](url), - lists, > blockquote, ```code```. HTML is stripped."
          value={currentTranslation.bodyMd}
          onChange={(e) => updateTranslation("bodyMd", e.target.value)}
        />
      ) : (
        <div className="min-h-[420px] rounded-md border border-border bg-card p-4">
          {previewLoading ? (
            <div className="text-sm text-muted-foreground">Rendering…</div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          )}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 md:-mx-8 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background/95 px-4 md:px-8 py-3 backdrop-blur">
        <div className="text-xs text-muted-foreground">
          {isNew ? "New article" : `Status (${activeLocale.toUpperCase()}): ${currentStatus}`}
          {isMock && " · sample data mode (read-only)"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleSave}
            disabled={pending || isMock || !canSave}
          >
            <Save /> {pending ? "Saving…" : isNew ? "Create draft" : "Save"}
          </Button>
          {!isNew && currentStatus === "published" ? (
            <Button
              type="button"
              variant="secondary"
              onClick={handleUnpublish}
              disabled={pending || isMock}
            >
              Unpublish ({activeLocale.toUpperCase()})
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handlePublish}
              disabled={pending || isMock || isNew}
            >
              <Send /> Publish ({activeLocale.toUpperCase()})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
