"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Mail, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import {
  markContactMessageResolvedAction,
  reopenContactMessageAction,
  deleteContactMessageAction,
} from "@/lib/admin/actions/contact-messages";
import type { ContactMessage, ContactMessageStatus } from "@/types/contact";

interface Props {
  initialMessages: ContactMessage[];
  canPersist: boolean;
}

export function ContactMessagesClient({ initialMessages, canPersist }: Props) {
  const t = useTranslations("contactAdmin");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [messages, setMessages] = useState(initialMessages);
  const [tab, setTab] = useState<ContactMessageStatus>("open");
  const [viewing, setViewing] = useState<ContactMessage | null>(null);
  const [deleting, setDeleting] = useState<ContactMessage | null>(null);

  const filtered = useMemo(
    () =>
      messages
        .filter((m) => m.status === tab)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [messages, tab],
  );

  async function resolve(id: string) {
    if (!canPersist) {
      toast.error(t("noPersistToast"));
      return;
    }
    const r = await markContactMessageResolvedAction(id);
    if (!r.ok) return toast.error(r.error);
    setMessages((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: "resolved" as const } : x)),
    );
    toast.success(t("resolvedToast"));
  }

  async function reopen(id: string) {
    if (!canPersist) {
      toast.error(t("noPersistToast"));
      return;
    }
    const r = await reopenContactMessageAction(id);
    if (!r.ok) return toast.error(r.error);
    setMessages((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: "open" as const } : x)),
    );
    toast.success(t("reopenedToast"));
  }

  async function confirmDelete() {
    if (!deleting) return;
    if (!canPersist) {
      toast.error(t("noPersistToast"));
      setDeleting(null);
      return;
    }
    const r = await deleteContactMessageAction(deleting.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setMessages((prev) => prev.filter((x) => x.id !== deleting.id));
    toast.success(t("deletedToast"));
    setDeleting(null);
  }

  function buildMailto(m: ContactMessage): string {
    const subject = encodeURIComponent(`Re: ${m.subject}`);
    const body = encodeURIComponent(
      `\n\n---\nOn ${new Date(m.createdAt).toLocaleString(locale)}, ${m.name} <${m.email}> wrote:\n\n${m.message
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n")}\n`,
    );
    return `mailto:${m.email}?subject=${subject}&body=${body}`;
  }

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as ContactMessageStatus)}>
        <TabsList>
          <TabsTrigger value="open">{t("tabOpen")}</TabsTrigger>
          <TabsTrigger value="resolved">{t("tabResolved")}</TabsTrigger>
        </TabsList>
        {(["open", "resolved"] as ContactMessageStatus[]).map((s) => (
          <TabsContent key={s} value={s} className="mt-4">
            {filtered.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t("empty")}
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">{t("columns.from")}</th>
                      <th className="px-3 py-2">{t("columns.subject")}</th>
                      <th className="px-3 py-2">{t("columns.received")}</th>
                      <th className="px-3 py-2 text-end">{t("columns.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m) => (
                      <tr key={m.id} className="border-t border-border align-top">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-foreground">{m.name}</div>
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => setViewing(m)}
                            className="text-left font-medium text-foreground hover:underline"
                          >
                            {m.subject}
                          </button>
                          <p className="mt-1 line-clamp-2 max-w-md text-xs text-muted-foreground">
                            {m.message}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {new Date(m.createdAt).toLocaleString(locale)}
                        </td>
                        <td className="px-3 py-2.5 text-end">
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="ghost" onClick={() => setViewing(m)}>
                              {t("viewMessage")}
                            </Button>
                            {m.status === "open" ? (
                              <Button
                                size="sm"
                                onClick={() => resolve(m.id)}
                                disabled={!canPersist}
                              >
                                <Check className="size-4" /> {t("markResolved")}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => reopen(m.id)}
                                disabled={!canPersist}
                              >
                                <RotateCcw className="size-4" /> {t("reopen")}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleting(m)}
                              disabled={!canPersist}
                              aria-label={t("delete")}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-2xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{t("messageDialogTitle", { name: viewing.name })}</DialogTitle>
                <DialogDescription>{viewing.email}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">{t("metaSubject")}</span>
                  <span className="font-medium text-foreground">{viewing.subject}</span>
                  <span className="text-muted-foreground">{t("metaReceived")}</span>
                  <span className="text-foreground">
                    {new Date(viewing.createdAt).toLocaleString(locale)}
                  </span>
                  {viewing.locale && (
                    <>
                      <span className="text-muted-foreground">{t("metaLocale")}</span>
                      <span className="text-foreground">{viewing.locale}</span>
                    </>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground/90">
                  {viewing.message}
                </div>
                {viewing.status === "resolved" && (
                  <Badge variant="neutral">{t("tabResolved")}</Badge>
                )}
              </div>
              <DialogFooter>
                <Button asChild>
                  <a href={buildMailto(viewing)}>
                    <Mail className="size-4" /> {t("replyByEmail")}
                  </a>
                </Button>
                {viewing.status === "open" ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      resolve(viewing.id);
                      setViewing(null);
                    }}
                    disabled={!canPersist}
                  >
                    <Check className="size-4" /> {t("markResolved")}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      reopen(viewing.id);
                      setViewing(null);
                    }}
                    disabled={!canPersist}
                  >
                    <RotateCcw className="size-4" /> {t("reopen")}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          {deleting && (
            <>
              <DialogHeader>
                <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
                <DialogDescription>
                  {t("deleteConfirmDescription", { name: deleting.name })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDeleting(null)}>
                  {tCommon("cancel")}
                </Button>
                <Button variant="danger" onClick={confirmDelete}>
                  <Trash2 className="size-4" /> {t("delete")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
