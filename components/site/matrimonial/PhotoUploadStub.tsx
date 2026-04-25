"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, X } from "lucide-react";

interface Props {
  initial: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}

export function PhotoUploadStub({ initial, onChange, max = 3 }: Props) {
  const [urls, setUrls] = useState<string[]>(initial);
  const t = useTranslations("matrimonial.onboarding");

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const next = [...urls];
    for (const f of files) {
      if (next.length >= max) break;
      next.push(URL.createObjectURL(f));
    }
    setUrls(next);
    onChange(next);
  }

  function remove(i: number) {
    const next = urls.filter((_, idx) => idx !== i);
    setUrls(next);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t("photoStubNote")}</p>
      <div className="grid grid-cols-3 gap-2">
        {urls.map((u, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
            <img src={u} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="Remove"
              onClick={() => remove(i)}
              className="absolute right-1 top-1 rounded-full bg-background/80 p-1 hover:bg-background"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {urls.length < max && (
          <label className="flex aspect-square cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground hover:bg-muted/60">
            <input type="file" multiple accept="image/*" className="hidden" onChange={pickFiles} />
            <ImagePlus className="size-5" />
          </label>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("photosNote")}</p>
    </div>
  );
}
