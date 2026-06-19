"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { formatRelative } from "@/lib/utils";
import { NotificationTypeIcon } from "@/components/admin/notifications/type-icon";
import type { AdminNotification, NotificationType } from "@/types/admin";

const TYPES: NotificationType[] = [
  "signup",
  "flagged",
  "donation",
  "qa",
  "system",
  "submission",
  "contact",
];

type Tab = "all" | "unread";
type TypeFilter = "all" | NotificationType;

interface Props {
  initialItems: AdminNotification[];
  canPersist: boolean;
}

export function NotificationsListClient({ initialItems, canPersist }: Props) {
  const t = useTranslations("notifications.page");
  const tParent = useTranslations("notifications");
  const [items, setItems] = useState<AdminNotification[]>(initialItems);
  const [tab, setTab] = useState<Tab>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const unreadCount = items.filter((n) => !n.read).length;

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (tab === "unread" && n.read) return false;
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      return true;
    });
  }, [items, tab, typeFilter]);

  async function markOne(id: string) {
    if (!canPersist) return;
    const target = items.find((n) => n.id === id);
    if (!target || target.read) return;
    const prev = items;
    setItems((cur) => cur.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      const res = await fetch(`/api/admin/notifications/${id}/read`, { method: "POST" });
      if (!res.ok) {
        setItems(prev);
        toast.error(t("markFailedToast"));
      }
    } catch {
      setItems(prev);
      toast.error(t("markFailedToast"));
    }
  }

  async function markAllRead() {
    if (!canPersist) return;
    if (unreadCount === 0) return;
    const prev = items;
    setItems((cur) => cur.map((n) => ({ ...n, read: true })));
    try {
      const res = await fetch("/api/admin/notifications/mark-all-read", { method: "POST" });
      if (!res.ok) {
        setItems(prev);
        toast.error(t("markFailedToast"));
        return;
      }
      toast.success(t("markedAllReadToast"));
    } catch {
      setItems(prev);
      toast.error(t("markFailedToast"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={markAllRead}
            disabled={!canPersist}
          >
            <CheckCheck className="size-4" />
            {tParent("markAllRead")}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="all">{tParent("tabAll")}</TabsTrigger>
            <TabsTrigger value="unread">
              {tParent("tabUnread")} {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          aria-label={t("filterByType")}
        >
          <option value="all">{t("filterAllTypes")}</option>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`types.${type}`)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {items.length === 0 ? t("emptyAll") : t("noResults")}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-md border border-border">
          {filtered.map((n, i) => (
            <li
              key={n.id}
              className={i === 0 ? "" : "border-t border-border"}
            >
              <NotificationRow
                item={n}
                onMark={markOne}
                markLabel={t("markRead")}
                canPersist={canPersist}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationRow({
  item,
  onMark,
  markLabel,
  canPersist,
}: {
  item: AdminNotification;
  onMark: (id: string) => void;
  markLabel: string;
  canPersist: boolean;
}) {
  const locale = useLocale();
  const body = (
    <>
      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <NotificationTypeIcon type={item.type} className="size-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
          {!item.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{item.body}</p>
        <span className="text-[11px] text-muted-foreground">{formatRelative(item.createdAt, locale)}</span>
      </div>
    </>
  );

  const rowClasses = "flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-muted/60";

  return (
    <div className="flex items-stretch">
      {item.link ? (
        <Link
          href={item.link}
          onClick={() => onMark(item.id)}
          className={rowClasses}
        >
          {body}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onMark(item.id)}
          className={rowClasses}
        >
          {body}
        </button>
      )}
      {!item.read && (
        <div className="flex shrink-0 items-center pe-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMark(item.id)}
            aria-label={markLabel}
            disabled={!canPersist}
          >
            <Check className="size-4" />
            <span className="hidden sm:inline">{markLabel}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
