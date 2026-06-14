"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Eye,
  Mail,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/admin/RowActions";
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

type StatusFilter = "all" | ContactMessageStatus;
type SortKey = "name" | "subject" | "status" | "createdAt";
type SortDir = "asc" | "desc";

const STATUS_FILTERS: StatusFilter[] = ["all", "open", "resolved"];

function statusVariant(s: ContactMessageStatus): "success" | "warning" {
  return s === "resolved" ? "success" : "warning";
}

function defaultDirFor(key: SortKey): SortDir {
  return key === "createdAt" ? "desc" : "asc";
}

function SortHeader({
  label,
  active,
  dir,
  onToggle,
  align = "start",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onToggle: () => void;
  align?: "start" | "end";
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1 hover:text-foreground ${
        align === "end" ? "justify-end" : ""
      }`}
    >
      <span>{label}</span>
      <Icon className={`size-3 ${active ? "text-foreground" : "opacity-60"}`} />
    </button>
  );
}

export function ContactMessagesClient({ initialMessages, canPersist }: Props) {
  const t = useTranslations("contactAdmin");
  const tCommon = useTranslations("common");
  const tStatuses = useTranslations("contactAdmin.statuses");
  const locale = useLocale();
  const [messages, setMessages] = useState(initialMessages);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewing, setViewing] = useState<ContactMessage | null>(null);
  const [deleting, setDeleting] = useState<ContactMessage | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = messages.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q)
      );
    });
    const sign = sortDir === "asc" ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "createdAt") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === "subject") {
        cmp = a.subject.localeCompare(b.subject);
      } else if (sortKey === "status") {
        cmp = a.status.localeCompare(b.status);
      }
      if (cmp !== 0) return cmp * sign;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [messages, query, statusFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(defaultDirFor(key));
    }
  }

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ps-8 w-64"
            aria-label={t("search")}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label={t("filterByStatus")}
        >
          {STATUS_FILTERS.map((v) => (
            <option key={v} value={v}>
              {tStatuses(v)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {messages.length === 0 ? t("empty") : t("noResults")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("columns.from")}
                    active={sortKey === "name"}
                    dir={sortDir}
                    onToggle={() => toggleSort("name")}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("columns.subject")}
                    active={sortKey === "subject"}
                    dir={sortDir}
                    onToggle={() => toggleSort("subject")}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("columns.status")}
                    active={sortKey === "status"}
                    dir={sortDir}
                    onToggle={() => toggleSort("status")}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("columns.received")}
                    active={sortKey === "createdAt"}
                    dir={sortDir}
                    onToggle={() => toggleSort("createdAt")}
                  />
                </th>
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
                  <td className="px-3 py-2.5">
                    <Badge variant={statusVariant(m.status)}>
                      {tStatuses(m.status)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    <RowActions label={tCommon("actions")}>
                      <DropdownMenuItem onClick={() => setViewing(m)}>
                        <Eye /> {t("viewMessage")}
                      </DropdownMenuItem>
                      {m.status === "open" ? (
                        <DropdownMenuItem
                          onClick={() => resolve(m.id)}
                          disabled={!canPersist}
                        >
                          <Check /> {t("markResolved")}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => reopen(m.id)}
                          disabled={!canPersist}
                        >
                          <RotateCcw /> {t("reopen")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="danger"
                        onClick={() => setDeleting(m)}
                        disabled={!canPersist}
                      >
                        <Trash2 /> {t("delete")}
                      </DropdownMenuItem>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                  <Badge variant="success">{tStatuses("resolved")}</Badge>
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
    </div>
  );
}
