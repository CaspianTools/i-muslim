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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import type { AdminHadith } from "@/lib/admin/data/hadith";

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
    <Sheet open={Boolean(hadith)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader>
          <SheetTitle>
            Edit hadith {collection} #{hadith?.number}
          </SheetTitle>
          <SheetDescription>
            Arabic text is read-only. Translations and metadata can be edited.
          </SheetDescription>
        </SheetHeader>
        {hadith && (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 overflow-y-auto p-5 space-y-4"
          >
            <div className="rounded-md bg-muted/40 p-3">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Arabic (read-only)
              </span>
              <p
                dir="rtl"
                lang="ar"
                className="mt-1 font-arabic text-lg leading-loose"
              >
                {hadith.text_ar}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hadith-en">English</Label>
              <textarea
                id="hadith-en"
                rows={5}
                className="flex w-full rounded-md border border-input bg-background p-2 text-sm"
                {...form.register("en")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hadith-ru">Russian</Label>
              <textarea
                id="hadith-ru"
                rows={5}
                className="flex w-full rounded-md border border-input bg-background p-2 text-sm"
                {...form.register("ru")}
              />
            </div>
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
                rows={2}
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

            <SheetFooter className="-mx-5 mt-auto">
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
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
