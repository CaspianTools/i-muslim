"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HandHeart, Loader2, Plus, ShieldOff } from "lucide-react";
import { addDua, makeDua, takeDownDua } from "@/app/[locale]/(site)/mosques/dua-actions";

export interface DuaVM {
  id: string;
  text: string;
  authorName: string;
  madeDuaCount: number;
  mine: boolean;
}

export function DuaWallClient({
  slug,
  signedIn,
  canModerate,
  initialDuas,
  variant = "rail",
}: {
  slug: string;
  signedIn: boolean;
  canModerate: boolean;
  initialDuas: DuaVM[];
  /** "rail" = compact single column (right rail); "wall" = full-tab masonry. */
  variant?: "rail" | "wall";
}) {
  const t = useTranslations("mosques.dua");
  const [duas, setDuas] = useState<DuaVM[]>(initialDuas);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const clean = text.trim();
    if (!clean) return;
    setBusy(true);
    const res = await addDua(slug, clean);
    setBusy(false);
    if (!res.ok || !res.id) {
      toast.error(t("addFailed"));
      return;
    }
    setDuas((d) => [{ id: res.id!, text: clean, authorName: "", madeDuaCount: 0, mine: false }, ...d]);
    setText("");
    setComposing(false);
  }

  async function toggleMake(id: string) {
    if (!signedIn) {
      toast.error(t("signInToMake"));
      return;
    }
    const cur = duas.find((d) => d.id === id);
    if (!cur) return;
    const had = cur.mine;
    setDuas((ds) =>
      ds.map((d) =>
        d.id === id ? { ...d, mine: !had, madeDuaCount: Math.max(0, d.madeDuaCount + (had ? -1 : 1)) } : d,
      ),
    );
    const res = await makeDua(slug, id);
    if (!res.ok) {
      setDuas((ds) =>
        ds.map((d) =>
          d.id === id ? { ...d, mine: had, madeDuaCount: Math.max(0, d.madeDuaCount + (had ? 1 : -1)) } : d,
        ),
      );
    }
  }

  async function remove(id: string) {
    const res = await takeDownDua(slug, id);
    if (res.ok) {
      setDuas((ds) => ds.filter((d) => d.id !== id));
      toast.success(t("takenDown"));
    }
  }

  // One du'a's inner content (text + author + made-du'a + moderation) — shared
  // by the rail <li> and the wall masonry tile so both stay in sync.
  const cardBody = (d: DuaVM) => (
    <>
      <p className="whitespace-pre-wrap break-words text-sm text-foreground">{d.text}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">
          {d.authorName || t("anonymous")}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          {canModerate && (
            <button
              type="button"
              onClick={() => remove(d.id)}
              title={t("takeDown")}
              className="text-muted-foreground hover:text-danger"
            >
              <ShieldOff className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleMake(d.id)}
            aria-pressed={d.mine}
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              d.mine ? "text-accent" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <HandHeart className={`size-3.5${d.mine ? " fill-current" : ""}`} />
            {d.madeDuaCount > 0 ? t("madeDuaCount", { count: d.madeDuaCount }) : t("madeDua")}
          </button>
        </div>
      </div>
    </>
  );

  // Composer — collapsed dashed button that expands into a textarea. Shared by
  // both variants; the wall places it on top, the rail at the bottom.
  const composer = composing ? (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={280}
        rows={variant === "wall" ? 3 : 2}
        placeholder={t("placeholder")}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="mt-2 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setComposing(false);
            setText("");
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t("cancel")}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-60"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {t("post")}
        </button>
      </div>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => (signedIn ? setComposing(true) : toast.error(t("signInToAdd")))}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent"
    >
      <Plus className="size-4" /> {t("add")}
    </button>
  );

  // Wall: prominent composer on top, then a CSS multi-column masonry of tiles.
  // Newest-first order puts the newest tile top-left; cards never split across a
  // column (break-inside-avoid) and carry their own vertical rhythm (mb-4, since
  // multi-column ignores row gap).
  if (variant === "wall") {
    return (
      <div className="space-y-4">
        {composer}
        {duas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {duas.map((d) => (
              <div
                key={d.id}
                className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                {cardBody(d)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Rail: compact single column with the dashed composer at the bottom.
  return (
    <div>
      {duas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {duas.map((d) => (
            <li key={d.id} className="rounded-xl bg-muted/50 p-3">
              {cardBody(d)}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">{composer}</div>
    </div>
  );
}
