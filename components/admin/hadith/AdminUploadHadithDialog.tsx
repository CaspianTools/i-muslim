"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("hadithAdmin.upload");

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
        setParseError(t("notAnExport"));
        return;
      }
      if (slug !== collection) {
        setParseError(t("wrongCollection", { slug, collection }));
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
        err instanceof Error
          ? t("parseFailed", { error: err.message })
          : t("parseFailedGeneric"),
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
        setSubmitError(err instanceof Error ? err.message : t("uploadFailed"));
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
          <span>{t("trigger")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{t("title")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("note")}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hadith-upload-file">{t("fileLabel")}</Label>
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
              {t("previewLine", { lang: preview.lang, count: preview.count })}
              {preview.scope === "book" && preview.bookNumber !== null
                ? t("previewBook", { number: preview.bookNumber })
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
              {t.rich("updatedCount", {
                count: result.updated,
                b: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
              {result.skippedPlaceholder > 0
                ? t("skippedPlaceholder", { count: result.skippedPlaceholder })
                : ""}
              {result.skippedNoChange > 0
                ? t("skippedNoChange", { count: result.skippedNoChange })
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
                  <li>{t("moreErrors", { count: result.errors.length - 20 })}</li>
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
            <span>{pending ? t("uploading") : t("trigger")}</span>
          </Button>
          {file ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={reset}
              disabled={pending}
            >
              {t("clear")}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
