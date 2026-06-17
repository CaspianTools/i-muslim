"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createNewsPost } from "@/app/[locale]/(site)/mosques/news-actions";
import {
  getManageUploadUrlAction,
  finalizeMosqueUploadAction,
} from "@/app/[locale]/(site)/mosques/manage-actions";

export function MosqueNewsComposer({ slug }: { slug: string }) {
  const t = useTranslations("mosques.news");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [image, setImage] = useState<{ url: string; storagePath: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const up = await getManageUploadUrlAction({
        slug,
        kind: "news",
        filename: file.name,
        contentType: file.type,
        contentLength: file.size,
      });
      if (!up.ok || !up.url || !up.storagePath || !up.publicUrl) {
        toast.error(t("postFailed"));
        return;
      }
      const put = await fetch(up.url, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!put.ok) {
        toast.error(t("postFailed"));
        return;
      }
      const fin = await finalizeMosqueUploadAction(slug, up.storagePath);
      if (!fin.ok || !fin.url) {
        toast.error(t("postFailed"));
        return;
      }
      setImage({ url: fin.url, storagePath: up.storagePath });
    } finally {
      setUploading(false);
    }
  }

  async function handlePost() {
    if (!body.trim()) {
      toast.error(t("bodyRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await createNewsPost(slug, { body, image });
      if (!res.ok) {
        toast.error(t("postFailed"));
        return;
      }
      setBody("");
      setImage(null);
      toast.success(t("posted"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder={t("composerPlaceholder")}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm"
      />
      {image && (
        <div className="relative mt-2 w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="" className="h-28 w-auto rounded-md border border-border object-cover" />
          <button
            type="button"
            onClick={() => setImage(null)}
            className="absolute end-1 top-1 inline-flex size-6 items-center justify-center rounded bg-background/90 text-danger"
            aria-label={t("removeImage")}
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted sm:h-9">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {t("addPhoto")}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImage} disabled={uploading} />
        </label>
        <Button onClick={handlePost} disabled={busy || uploading} size="sm" className="h-11 sm:h-9">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {t("post")}
        </Button>
      </div>
    </div>
  );
}
