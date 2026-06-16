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
}: {
  slug: string;
  signedIn: boolean;
  canModerate: boolean;
  initialDuas: DuaVM[];
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

  return (
    <div>
      {duas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {duas.map((d) => (
            <li key={d.id} className="rounded-xl bg-muted/50 p-3">
              <p className="text-sm text-foreground">{d.text}</p>
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
            </li>
          ))}
        </ul>
      )}

      {composing ? (
        <div className="mt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={280}
            rows={2}
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
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="size-4" /> {t("add")}
        </button>
      )}
    </div>
  );
}
