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
import type { AdminAyah } from "@/types/admin-content";

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
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter by number or translation…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-md"
        />
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
              {a.translations.en && (
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">EN</span>
                  <p className="text-foreground">{a.translations.en}</p>
                </div>
              )}
              {a.translations.ru && (
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">RU</span>
                  <p className="text-foreground">{a.translations.ru}</p>
                </div>
              )}
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
    <Sheet open={Boolean(ayah)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader>
          <SheetTitle>Edit ayah {surah}:{ayah?.ayah}</SheetTitle>
          <SheetDescription>
            Arabic text is read-only. Translations and metadata can be edited.
          </SheetDescription>
        </SheetHeader>
        {ayah && (
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
                className="mt-1 font-arabic text-xl leading-loose"
              >
                {ayah.text_ar}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ayah-en">English</Label>
              <textarea
                id="ayah-en"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background p-2 text-sm"
                {...form.register("en")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ayah-ru">Russian</Label>
              <textarea
                id="ayah-ru"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background p-2 text-sm"
                {...form.register("ru")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ayah-translit">Transliteration</Label>
              <textarea
                id="ayah-translit"
                rows={2}
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
