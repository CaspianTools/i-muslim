"use client";

import { Link } from "@/i18n/navigation";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
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
import { toast } from "@/components/ui/sonner";
import {
  archiveBusinessAction,
  restoreBusinessAction,
} from "@/lib/admin/actions/businesses";
import type { BusinessSubmission } from "@/lib/admin/data/businesses";
import type {
  Business,
  BusinessAmenity,
  BusinessCategory,
  BusinessCertificationBody,
  BusinessStatus,
  HalalStatus,
} from "@/types/business";
import { BusinessEditorDrawer } from "./BusinessEditorDrawer";

interface Props {
  initialBusinesses: Business[];
  pendingSubmissions: BusinessSubmission[];
  categories: BusinessCategory[];
  amenities: BusinessAmenity[];
  certBodies: BusinessCertificationBody[];
  canPersist: boolean;
}

const STATUS_VALUES = ["all", "submitted", "draft", "published", "archived"] as const;
const HALAL_VALUES = ["all", "certified", "self_declared", "muslim_owned", "unverified"] as const;

type ListingRow =
  | { kind: "business"; b: Business; sortAt: number }
  | { kind: "submission"; s: BusinessSubmission; sortAt: number };

function halalVariant(s: HalalStatus): "success" | "info" | "warning" | "neutral" {
  if (s === "certified") return "success";
  if (s === "muslim_owned") return "info";
  if (s === "self_declared") return "warning";
  return "neutral";
}

function statusVariant(s: BusinessStatus): "success" | "warning" | "neutral" {
  if (s === "published") return "success";
  if (s === "archived") return "neutral";
  return "warning";
}

export function BusinessesPageClient({
  initialBusinesses,
  pendingSubmissions,
  categories,
  amenities,
  certBodies,
  canPersist,
}: Props) {
  const t = useTranslations("businesses");
  const tAdmin = useTranslations("businesses.admin");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("businesses.statuses");
  const tHalal = useTranslations("businesses.halalStatuses");
  const locale = useLocale() as "en" | "ar" | "tr" | "id";

  const [businesses, setBusinesses] = useState<Business[]>(initialBusinesses);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_VALUES)[number]>("all");
  const [halalFilter, setHalalFilter] = useState<(typeof HALAL_VALUES)[number]>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Business | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<Business | null>(null);

  const categoryById = useMemo(() => {
    const map = new Map<string, BusinessCategory>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const filtered = useMemo<ListingRow[]>(() => {
    const q = query.trim().toLowerCase();

    const businessRows: ListingRow[] = businesses
      .filter((b) =>
        statusFilter === "all"
          ? true
          : statusFilter === "submitted"
            ? false
            : b.status === statusFilter,
      )
      .filter((b) => halalFilter === "all" || b.halal.status === halalFilter)
      .filter((b) => categoryFilter === "all" || b.categoryIds.includes(categoryFilter))
      .filter((b) => {
        if (!q) return true;
        return (
          b.name.toLowerCase().includes(q) ||
          b.address.city.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q)
        );
      })
      .map((b) => ({ kind: "business", b, sortAt: new Date(b.updatedAt).getTime() }));

    const submissionRows: ListingRow[] = pendingSubmissions
      .filter(() => statusFilter === "all" || statusFilter === "submitted")
      .filter((s) => halalFilter === "all" || s.payload.halalStatus === halalFilter)
      .filter((s) => categoryFilter === "all" || s.payload.categoryIds.includes(categoryFilter))
      .filter((s) => {
        if (!q) return true;
        return (
          s.payload.name.toLowerCase().includes(q) ||
          s.payload.city.toLowerCase().includes(q)
        );
      })
      .map((s) => ({ kind: "submission", s, sortAt: new Date(s.createdAt).getTime() }));

    return [...businessRows, ...submissionRows].sort((a, b) => b.sortAt - a.sortAt);
  }, [businesses, pendingSubmissions, query, statusFilter, halalFilter, categoryFilter]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(b: Business) {
    setEditing(b);
    setEditorOpen(true);
  }

  function handleSaved(saved: Business, mode: "create" | "update") {
    setBusinesses((prev) => {
      if (mode === "create") return [saved, ...prev];
      return prev.map((b) => (b.id === saved.id ? saved : b));
    });
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    const target = archiveTarget;
    setArchiveTarget(null);
    if (!canPersist) {
      toast.error(tAdmin("noPersistToast"));
      return;
    }
    const result = await archiveBusinessAction(target.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setBusinesses((prev) =>
      prev.map((b) => (b.id === target.id ? { ...b, status: "archived" } : b)),
    );
    toast.success(tAdmin("archivedToast", { name: target.name }));
  }

  async function handleRestore(b: Business) {
    if (!canPersist) {
      toast.error(tAdmin("noPersistToast"));
      return;
    }
    const result = await restoreBusinessAction(b.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setBusinesses((prev) => prev.map((x) => (x.id === b.id ? { ...x, status: "draft" } : x)));
    toast.success(tAdmin("restoredToast", { name: b.name }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute start-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tAdmin("searchPlaceholder")}
            className="ps-8"
          />
        </div>
        <select
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_VALUES)[number])}
          aria-label={tAdmin("filterByStatus")}
        >
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>{tStatus(s)}</option>
          ))}
        </select>
        <select
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={halalFilter}
          onChange={(e) => setHalalFilter(e.target.value as (typeof HALAL_VALUES)[number])}
          aria-label={tAdmin("filterByHalal")}
        >
          {HALAL_VALUES.map((s) => (
            <option key={s} value={s}>{tHalal(s)}</option>
          ))}
        </select>
        <select
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label={tAdmin("filterByCategory")}
        >
          <option value="all">{tAdmin("filterByCategory")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name[locale] ?? c.name.en}</option>
          ))}
        </select>
        <Button onClick={openCreate} disabled={!canPersist}>
          <Plus className="size-4" /> {t("createCta")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">{t("columns.name")}</th>
              <th className="px-3 py-2">{t("columns.category")}</th>
              <th className="px-3 py-2">{t("columns.halal")}</th>
              <th className="px-3 py-2">{t("columns.status")}</th>
              <th className="px-3 py-2">{t("columns.updated")}</th>
              <th className="px-3 py-2 text-end">{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                  {tAdmin("noResults")}
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                if (row.kind === "submission") {
                  const s = row.s;
                  const primaryCategory = s.payload.categoryIds[0]
                    ? categoryById.get(s.payload.categoryIds[0])
                    : null;
                  return (
                    <tr key={`sub-${s.id}`} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground">{s.payload.name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" /> {s.payload.city}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-sm">
                        {primaryCategory ? primaryCategory.name[locale] ?? primaryCategory.name.en : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={halalVariant(s.payload.halalStatus)}>
                          {tHalal(s.payload.halalStatus)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="warning">{tStatus("submitted")}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString(locale)}
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={tCommon("actions")}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href="/admin/businesses/submissions">
                                <ExternalLink className="size-4" /> {tAdmin("reviewCta")}
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                }

                const b = row.b;
                const primaryCategory = b.categoryIds[0] ? categoryById.get(b.categoryIds[0]) : null;
                return (
                  <tr key={b.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => openEdit(b)}
                        className="block text-start font-medium text-foreground hover:underline"
                      >
                        {b.name}
                      </button>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" /> {b.address.city}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      {primaryCategory ? primaryCategory.name[locale] ?? primaryCategory.name.en : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Badge variant={halalVariant(b.halal.status)}>{tHalal(b.halal.status)}</Badge>
                        {b.platformVerifiedAt && (
                          <ShieldCheck className="size-3.5 text-info" aria-label={t("halal.verified_by_platform")} />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={statusVariant(b.status)}>{tStatus(b.status)}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {new Date(b.updatedAt).toLocaleDateString(locale)}
                    </td>
                    <td className="px-3 py-2.5 text-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={tCommon("actions")}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(b)}>
                            <Pencil className="size-4" /> {t("editCta")}
                          </DropdownMenuItem>
                          {b.status === "published" && (
                            <DropdownMenuItem asChild>
                              <Link href={`/businesses/${b.slug}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="size-4" /> {t("viewOnSite")}
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {b.status !== "archived" ? (
                            <DropdownMenuItem
                              onSelect={() => setArchiveTarget(b)}
                              className="text-danger"
                            >
                              <Archive className="size-4" /> {t("archiveCta")}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => handleRestore(b)}>
                              <ArchiveRestore className="size-4" /> {t("restoreCta")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <BusinessEditorDrawer
        open={editorOpen}
        onOpenChange={setEditorOpen}
        business={editing}
        categories={categories}
        amenities={amenities}
        certBodies={certBodies}
        canPersist={canPersist}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={tAdmin("archiveTitle")}
        description={tAdmin("archiveDescription", { name: archiveTarget?.name ?? "" })}
        confirmLabel={t("archiveCta")}
        onConfirm={handleArchive}
      />
    </div>
  );
}
