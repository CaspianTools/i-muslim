"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ImageIcon, Loader2, X } from "lucide-react";
import {
  getManageUploadUrlAction,
  finalizeMosqueUploadAction,
} from "@/app/[locale]/(site)/mosques/manage-actions";

const ACCEPT = "image/jpeg,image/png,image/webp";
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX = 5 * 1024 * 1024;

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("put")));
    xhr.onerror = () => reject(new Error("net"));
    xhr.send(file);
  });
}

function humanSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drag-and-drop image upload field for masjid logo/cover. Uploads via a
 * signed-URL flow with a real progress bar (XHR) and reports the resulting
 * `{ url, storagePath }` to `onUploaded`.
 *
 * By default it uses the manager-auth flow (signed URL → PUT → finalize token
 * URL) used by the public Manage panel. The admin form passes `requestUpload`
 * + `resolveUrl` overrides so the same UI drives the admin-auth upload backend
 * (which has no separate finalize step and builds the URL from the path).
 */
export function ImageDropzone({
  slug,
  kind,
  currentUrl,
  onUploaded,
  previewClassName = "size-16 rounded-md border border-border object-cover",
  requestUpload,
  resolveUrl,
  onRemove,
}: {
  slug: string;
  kind: "logo" | "cover";
  currentUrl?: string | null;
  onUploaded: (img: { url: string; storagePath: string }) => void;
  previewClassName?: string;
  /** Override the upload backend. Returns the signed PUT URL + storage path. */
  requestUpload?: (file: File) => Promise<{ putUrl: string; storagePath: string }>;
  /** Override how the final display URL is derived from the storage path. */
  resolveUrl?: (storagePath: string) => Promise<string>;
  /** When provided, renders a remove affordance over the current preview. */
  onRemove?: () => void | Promise<void>;
}) {
  const t = useTranslations("mosques.manage");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function defaultRequestUpload(file: File): Promise<{ putUrl: string; storagePath: string }> {
    const up = await getManageUploadUrlAction({
      slug,
      kind,
      filename: file.name,
      contentType: file.type,
      contentLength: file.size,
    });
    if (!up.ok || !up.url || !up.storagePath) throw new Error("url");
    return { putUrl: up.url, storagePath: up.storagePath };
  }

  async function defaultResolveUrl(storagePath: string): Promise<string> {
    const fin = await finalizeMosqueUploadAction(slug, storagePath);
    if (!fin.ok || !fin.url) throw new Error("finalize");
    return fin.url;
  }

  async function handleFile(file: File) {
    setError(null);
    setDone(false);
    if (!ALLOWED.includes(file.type)) return setError(t("uploadTypeError"));
    if (file.size > MAX) return setError(t("uploadSizeError"));
    setFileMeta({ name: file.name, size: file.size });
    setBusy(true);
    setProgress(0);
    try {
      const { putUrl, storagePath } = await (requestUpload ?? defaultRequestUpload)(file);
      await putWithProgress(putUrl, file, setProgress);
      const url = await (resolveUrl ?? defaultResolveUrl)(storagePath);
      setProgress(100);
      setDone(true);
      onUploaded({ url, storagePath });
    } catch {
      setError(t("saveFailed"));
      setProgress(null);
      setFileMeta(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setDone(false);
    setProgress(null);
    setFileMeta(null);
    await onRemove?.();
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? "border-accent bg-selected/50" : "border-input hover:border-accent/60 hover:bg-muted/40"
        }`}
      >
        {currentUrl && onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleRemove();
            }}
            disabled={busy}
            aria-label={t("removePhoto")}
            className="absolute end-2 top-2 inline-flex size-7 items-center justify-center rounded-md bg-background/90 text-danger transition-colors hover:bg-background"
          >
            <X className="size-4" />
          </button>
        )}
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="" className={previewClassName} />
        ) : (
          <div className="grid size-12 place-items-center rounded-xl bg-selected text-accent">
            <ImageIcon className="size-6" />
          </div>
        )}
        <p className="mt-2 text-sm text-foreground">
          {t("dropHere")} <span className="font-medium text-accent">{t("browse")}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("uploadSupports")}</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void handleFile(f);
          }}
        />
      </div>

      {fileMeta && progress !== null && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
          {busy ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Check className="size-4 shrink-0 text-success" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-foreground">{fileMeta.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {done ? humanSize(fileMeta.size) : `${progress}%`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
