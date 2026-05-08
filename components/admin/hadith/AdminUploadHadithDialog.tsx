"use client";

import { useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

type Props = {
  collection: string;
};

type Preview = {
  schema: string | null;
  lang: string;
  count: number;
  collectionSlug: string;
  scope: string | null;
  bookNumber: number | null;
};

type UploadResult = {
  ok: true;
  collection: string;
  lang: string;
  updated: number;
  skippedPlaceholder: number;
  skippedNoChange: number;
  errors: Array<{ number: number; reason: string }>;
};

export function AdminUploadHadithDialog({ collection }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [pending, startTransition] = useTransition();

  const handleFile = async (next: File | null) => {
    setFile(next);
    setRawText(null);
    setPreview(null);
    setParseError(null);
    setSubmitError(null);
    setResult(null);
    if (!next) return;

    try {
      const text = await next.text();
      const parsed = JSON.parse(text);
      const slug =
        parsed?.collection && typeof parsed.collection.slug === "string"
          ? parsed.collection.slug
          : null;
      const lang = typeof parsed?.lang === "string" ? parsed.lang : null;
      const arr = Array.isArray(parsed?.hadith) ? parsed.hadith : null;
      if (!slug || !lang || !arr) {
        setParseError("File doesn't look like an i-muslim hadith export.");
        return;
      }
      if (slug !== collection) {
        setParseError(
          `File is for collection "${slug}", but you're uploading to "${collection}".`,
        );
        return;
      }
      setRawText(text);
      setPreview({
        schema: typeof parsed.schema === "string" ? parsed.schema : null,
        lang,
        count: arr.length,
        collectionSlug: slug,
        scope: typeof parsed.scope === "string" ? parsed.scope : null,
        bookNumber:
          parsed?.book && typeof parsed.book.number === "number"
            ? parsed.book.number
            : null,
      });
    } catch (err) {
      setParseError(
        err instanceof Error ? `Couldn't parse JSON: ${err.message}` : "Couldn't parse JSON.",
      );
    }
  };

  const handleSubmit = () => {
    if (!rawText) return;
    setSubmitError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/hadith/${collection}/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: rawText,
        });
        const json = (await res.json()) as
          | UploadResult
          | { error: string; issues?: Array<{ path: string; message: string }> };
        if (!res.ok || !("ok" in json)) {
          const err = json as { error: string };
          setSubmitError(err.error ?? `HTTP ${res.status}`);
          return;
        }
        setResult(json);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  };

  const reset = () => {
    setFile(null);
    setRawText(null);
    setPreview(null);
    setParseError(null);
    setSubmitError(null);
    setResult(null);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <Upload aria-hidden="true" />
          <span>Upload</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Upload translated JSON</h3>
          <p className="text-xs text-muted-foreground">
            Merges translations + status into Firestore. Reference fields
            (narrator, grades, tags, notes) are not modified.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hadith-upload-file">JSON file</Label>
          <input
            id="hadith-upload-file"
            type="file"
            accept=".json,application/json"
            disabled={pending}
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
          />
        </div>

        {parseError ? (
          <p role="alert" className="text-xs text-danger">
            {parseError}
          </p>
        ) : null}

        {preview ? (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
            <p className="font-medium">{preview.collectionSlug}</p>
            <p className="text-muted-foreground">
              {preview.lang} · {preview.count} hadith
              {preview.scope === "book" && preview.bookNumber !== null
                ? ` · book ${preview.bookNumber}`
                : ""}
              {preview.schema ? ` · ${preview.schema}` : ""}
            </p>
          </div>
        ) : null}

        {submitError ? (
          <p role="alert" className="text-xs text-danger">
            {submitError}
          </p>
        ) : null}

        {result ? (
          <div className="space-y-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs">
            <p>
              <span className="font-medium">{result.updated}</span> updated
              {result.skippedPlaceholder > 0
                ? ` · ${result.skippedPlaceholder} skipped (placeholder)`
                : ""}
              {result.skippedNoChange > 0
                ? ` · ${result.skippedNoChange} skipped (no change)`
                : ""}
            </p>
            {result.errors.length > 0 ? (
              <ul className="space-y-0.5 text-danger">
                {result.errors.slice(0, 20).map((e, i) => (
                  <li key={`${e.number}-${i}`}>
                    #{e.number}: {e.reason}
                  </li>
                ))}
                {result.errors.length > 20 ? (
                  <li>… and {result.errors.length - 20} more.</li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={pending || !rawText || !!parseError}
            className="flex-1"
          >
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Upload aria-hidden="true" />
            )}
            <span>{pending ? "Uploading…" : "Upload"}</span>
          </Button>
          {file ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={reset}
              disabled={pending}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
