"use client";

import { useMemo, useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  ExternalLink,
  Eye,
  MoreHorizontal,
  Search,
  ShieldX,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { NewMosqueButton } from "@/components/admin/mosques/NewMosqueButton";
import { toast } from "sonner";
import { cn, formatRelative } from "@/lib/utils";
import type { Mosque, MosqueStatus } from "@/types/mosque";
import { deleteMosque, setMosqueStatus } from "@/app/[locale]/(admin)/admin/mosques/actions";
import { countryName } from "@/lib/mosques/countries";

const STATUS_VALUES = ["all", "draft", "pending_review", "published", "suspended"] as const;
const PAGE_SIZES = [10, 25, 50, 100];

function statusVariant(status: MosqueStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "pending_review") return "warning";
  if (status === "suspended") return "danger";
  return "neutral";
}

export function MosquesPageClient({
  initialMosques,
}: {
  initialMosques: Mosque[];
}) {
  const router = useRouter();
  const t = useTranslations("mosquesAdmin");
  const tCommon = useTranslations("common");
  const tStatuses = useTranslations("mosquesAdmin.statuses");
  const tActions = useTranslations("mosquesAdmin.form.actions");
  const tToast = useTranslations("mosquesAdmin.actions");

  const [mosques, setMosques] = useState<Mosque[]>(initialMosques);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MosqueStatus | "all">("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [deleteTarget, setDeleteTarget] = useState<Mosque | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return mosques.filter((m) => {
      if (status !== "all" && m.status !== status) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !m.name.en.toLowerCase().includes(q) &&
          !m.city.toLowerCase().includes(q) &&
          !m.country.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [mosques, query, status]);

  const pageStart = pageIndex * pageSize;
  const visible = filtered.slice(pageStart, pageStart + pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  function callAction(name: string, fn: () => Promise<{ ok: boolean; error?: string }>, onOk: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(`${tToast("errorGeneric")} (${res.error ?? name})`);
        return;
      }
      onOk();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    callAction(
      "delete",
      () => deleteMosque(target.slug),
      () => {
        setMosques((prev) => prev.filter((m) => m.slug !== target.slug));
        setDeleteTarget(null);
        toast.success(tToast("deletedToast", { name: target.name.en }));
      },
    );
  }

  function handleStatus(target: Mosque, next: MosqueStatus) {
    callAction(
      "status",
      () => setMosqueStatus(target.slug, next),
      () => {
        setMosques((prev) => prev.map((m) => (m.slug === target.slug ? { ...m, status: next } : m)));
        if (next === "published") toast.success(tToast("publishedToast", { name: target.name.en }));
        else if (next === "suspended") toast.success(tToast("suspendedToast", { name: target.name.en }));
        else toast.success(tToast("updatedToast", { name: target.name.en }));
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPageIndex(0);
            }}
            className="ps-8 w-64"
            aria-label={t("search")}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as MosqueStatus | "all");
            setPageIndex(0);
          }}
          aria-label={t("filterByStatus")}
        >
          {STATUS_VALUES.map((v) => (
            <option key={v} value={v}>
              {tStatuses(v)}
            </option>
          ))}
        </select>
        <div className="ms-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/admin/mosques/import">
              <Upload /> {t("importCta")}
            </Link>
          </Button>
          <NewMosqueButton label={t("newMosque")} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("columns.name")}
                </th>
                <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("columns.city")}
                </th>
                <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("columns.country")}
                </th>
                <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("columns.status")}
                </th>
                <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("columns.updatedAt")}
                </th>
                <th className="px-3 py-2 w-12" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    {t("noResults")}
                  </td>
                </tr>
              ) : (
                visible.map((m) => (
                  <tr
                    key={m.slug}
                    className={cn(
                      "border-b border-border last:border-b-0 hover:bg-muted/40 cursor-pointer",
                    )}
                    onClick={() => router.push(`/admin/mosques/${m.slug}/edit`)}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{m.name.en}</div>
                      {m.name.ar && (
                        <div dir="rtl" lang="ar" className="font-arabic text-sm text-muted-foreground">
                          {m.name.ar}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{m.city}</td>
                    <td className="px-3 py-2 text-muted-foreground">{countryName(m.country)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={statusVariant(m.status)}>{tStatuses(m.status)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">
                      {formatRelative(m.updatedAt)}
                    </td>
                    <td className="px-3 py-2 text-end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${m.name.en}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/mosques/${m.slug}/edit`}>
                              <Edit /> {tCommon("edit")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/mosques/${m.slug}`} target="_blank" rel="noopener noreferrer">
                              <Eye /> View public page <ExternalLink className="ms-auto size-3" />
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {m.status !== "published" && (
                            <DropdownMenuItem onClick={() => handleStatus(m, "published")}>
                              <Upload /> {tActions("publish")}
                            </DropdownMenuItem>
                          )}
                          {m.status === "published" && (
                            <DropdownMenuItem onClick={() => handleStatus(m, "draft")}>
                              {tActions("unpublish")}
                            </DropdownMenuItem>
                          )}
                          {m.status !== "suspended" && (
                            <DropdownMenuItem onClick={() => handleStatus(m, "suspended")}>
                              <ShieldX /> {tActions("suspend")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="danger" onClick={() => setDeleteTarget(m)}>
                            <Trash2 /> {tCommon("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Rows per page</span>
            <select
              className="h-7 rounded-md border border-input bg-background px-1"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPageIndex(0);
              }}
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground tabular-nums">
            <span>
              {filtered.length === 0
                ? "0"
                : `${pageStart + 1}–${Math.min(pageStart + pageSize, filtered.length)} of ${filtered.length}`}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next"
              disabled={pageIndex >= pageCount - 1}
              onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title={t("deleteTitle")}
        description={deleteTarget ? t("deleteDescription", { name: deleteTarget.name.en }) : ""}
        confirmLabel={tCommon("delete")}
        confirmWord={deleteTarget?.name.en}
        onConfirm={handleDelete}
      />
    </div>
  );
}
