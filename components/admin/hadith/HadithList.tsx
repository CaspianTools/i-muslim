"use client";

import { useMemo, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import type { AdminHadith } from "@/types/admin-content";

const Schema = z.object({
  en: z.string().max(20000),
  ru: z.string().max(20000),
  narrator: z.string().max(500),
  grade: z.string().max(200),
  notes: z.string().max(4000),
  tags: z.string().max(500),
  published: z.boolean(),
});
type Values = z.infer<typeof Schema>;

export function HadithList({
  entries,
  collection,
}: {
  entries: AdminHadith[];
  collection: string;
}) {
  const [items, setItems] = useState(entries);
  const [editing, setEditing] = useState<AdminHadith | null>(null);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter.trim()) return items;
    const q = filter.toLowerCase();
    return items.filter(
      (h) =>
        String(h.number).includes(q) ||
        h.translations.en.toLowerCase().includes(q) ||
        h.translations.ru.toLowerCase().includes(q) ||
        (h.narrator ?? "").toLowerCase().includes(q),
    );
  }, [items, filter]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter by number, narrator, or text…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-md"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} / {items.length}
        </span>
      </div>

      <div className="space-y-2">
        {filtered.map((h) => (
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
              {h.translations.en && (
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">EN</span>
                  <p className="text-foreground">{h.translations.en}</p>
                </div>
              )}
              {h.translations.ru && (
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">RU</span>
                  <p className="text-foreground">{h.translations.ru}</p>
                </div>
              )}
            </div>
            {h.notes && (
              <p className="mt-2 rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                Notes: {h.notes}
              </p>
            )}
          </article>
        ))}
      </div>

      <EditHadithDrawer
        collection={collection}
        hadith={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setItems((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
          setEditing(null);
        }}
      />
    </div>
  );
}

function EditHadithDrawer({
  collection,
  hadith,
  onClose,
  onSaved,
}: {
  collection: string;
  hadith: AdminHadith | null;
  onClose: () => void;
  onSaved: (h: AdminHadith) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    values: hadith
      ? {
          en: hadith.translations.en,
          ru: hadith.translations.ru,
          narrator: hadith.narrator ?? "",
          grade: hadith.grade ?? "",
          notes: hadith.notes ?? "",
          tags: hadith.tags.join(", "),
          published: hadith.published,
        }
      : {
          en: "",
          ru: "",
          narrator: "",
          grade: "",
          notes: "",
          tags: "",
          published: true,
        },
  });

  async function onSubmit(values: Values) {
    if (!hadith) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/hadith/${collection}/${hadith.number}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          translations: { en: values.en, ru: values.ru },
          narrator: values.narrator || null,
          grade: values.grade || null,
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

      const updated: AdminHadith = {
        ...hadith,
        translations: { en: values.en, ru: values.ru },
        narrator: values.narrator || null,
        grade: values.grade || null,
        notes: values.notes || null,
        tags: values.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        published: values.published,
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
                Arabic text is read-only. Translations and metadata can be edited.
              </EditorDialogDescription>
            </EditorDialogHeader>
            <EditorDialogBody className="overflow-hidden p-0">
              <div className="grid h-full grid-cols-1 lg:grid-cols-[30%_1fr]">
                <div className="space-y-4 overflow-y-auto p-5 lg:border-e lg:border-border">
                  <div className="space-y-1.5">
                    <Label htmlFor="hadith-narrator">Narrator</Label>
                    <Input id="hadith-narrator" {...form.register("narrator")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hadith-grade">Grade</Label>
                    <Input id="hadith-grade" {...form.register("grade")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hadith-tags">Tags (comma-separated)</Label>
                    <Input id="hadith-tags" {...form.register("tags")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hadith-notes">Internal notes</Label>
                    <textarea
                      id="hadith-notes"
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
                      <TabsTrigger value="en">English</TabsTrigger>
                      <TabsTrigger value="ru">Russian</TabsTrigger>
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
                  <TabsContent value="en" className="mt-3 flex flex-1 flex-col">
                    <Label htmlFor="hadith-en" className="sr-only">English</Label>
                    <textarea
                      id="hadith-en"
                      className="flex h-full min-h-[240px] w-full flex-1 resize-none rounded-md border border-input bg-background p-3 text-sm"
                      {...form.register("en")}
                    />
                  </TabsContent>
                  <TabsContent value="ru" className="mt-3 flex flex-1 flex-col">
                    <Label htmlFor="hadith-ru" className="sr-only">Russian</Label>
                    <textarea
                      id="hadith-ru"
                      className="flex h-full min-h-[240px] w-full flex-1 resize-none rounded-md border border-input bg-background p-3 text-sm"
                      {...form.register("ru")}
                    />
                  </TabsContent>
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
