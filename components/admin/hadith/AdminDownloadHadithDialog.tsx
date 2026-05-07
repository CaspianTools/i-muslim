"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { ALL_LANGS, LANG_LABELS } from "@/lib/translations";

type Scope =
  | { scope: "collection"; collection: string }
  | { scope: "book"; collection: string; book: number };

type Props = Scope;

type LangChoice = "all" | (typeof ALL_LANGS)[number];

export function AdminDownloadHadithDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<LangChoice>("all");
  const [chunked, setChunked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isCollection = props.scope === "collection";

  const handleDownload = () => {
    setError(null);
    startTransition(async () => {
      try {
        const params = new URLSearchParams();
        if (lang !== "all") params.set("lang", lang);
        if (isCollection && chunked) params.set("chunked", "1");

        const path = isCollection
          ? `/api/admin/hadith/${props.collection}/download`
          : `/api/admin/hadith/${props.collection}/book/${props.book}/download`;

        const qs = params.toString();
        const url = qs ? `${path}?${qs}` : path;

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const cd = res.headers.get("Content-Disposition") ?? "";
        const m = /filename="([^"]+)"/.exec(cd);
        const langSuffix = lang === "all" ? "" : `-${lang}`;
        const fallbackName = isCollection
          ? chunked
            ? `${props.collection}${langSuffix}-by-book.zip`
            : `${props.collection}${langSuffix}.json`
          : `${props.collection}-book-${props.book}${langSuffix}.json`;
        const filename = m?.[1] ?? fallbackName;

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
        setOpen(false);
      } catch {
        setError("Download failed. Please try again.");
      }
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <Download aria-hidden="true" />
          <span>Download</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">
            {isCollection ? "Download collection" : "Download book"}
          </h3>
          <p className="text-xs text-muted-foreground">
            Includes drafts and admin metadata.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hadith-download-lang">Language</Label>
          <select
            id="hadith-download-lang"
            value={lang}
            onChange={(e) => setLang(e.target.value as LangChoice)}
            disabled={pending}
            className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="all">All languages</option>
            {ALL_LANGS.map((code) => (
              <option key={code} value={code}>
                {LANG_LABELS[code] ?? code} ({code})
              </option>
            ))}
          </select>
        </div>

        {isCollection ? (
          <fieldset className="space-y-1.5" disabled={pending}>
            <legend className="text-sm font-medium">Format</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="format"
                checked={!chunked}
                onChange={() => setChunked(false)}
              />
              <span>Single JSON file</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="format"
                checked={chunked}
                onChange={() => setChunked(true)}
              />
              <span>ZIP — one JSON per book</span>
            </label>
          </fieldset>
        ) : null}

        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleDownload}
          disabled={pending}
          className="w-full"
        >
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Download aria-hidden="true" />
          )}
          <span>{pending ? "Preparing…" : "Download"}</span>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
