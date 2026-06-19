"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarPlus,
  ConciergeBell,
  FileText,
  type LucideIcon,
  Plus,
  Store,
  Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  EditorDialog,
  EditorDialogContent,
  EditorDialogTitle,
} from "@/components/ui/editor-dialog";
import { cn } from "@/lib/utils";
import { SubmitEventForm } from "@/components/site/events/SubmitEventForm";
import { SubmitBusinessForm } from "@/components/businesses/SubmitBusinessForm";
import { SubmitMosqueForm } from "@/components/mosque/SubmitMosqueForm";
import { ArticleEditorClient } from "./articles/ArticleEditorClient";
import { ArticleCategoryForm } from "./articles/ArticleCategoryForm";
import { EventCategoryForm } from "./events/EventCategoryForm";
import { BusinessCategoryForm } from "./businesses/BusinessCategoryForm";
import { BusinessAmenityForm } from "./businesses/BusinessAmenityForm";
import { CertBodyForm } from "./businesses/CertBodyForm";
import { MosqueFacilityForm } from "./mosques/MosqueFacilityForm";
import type { BusinessCategory } from "@/types/business";
import type { EventCategoryDoc } from "@/types/event-category";
import type { ArticleCategoryDoc } from "@/types/blog";
import type { Mosque, MosqueFacility } from "@/types/mosque";
import { usePermissions } from "./PermissionsContext";
import { CREATE_PERMISSION } from "@/lib/admin/create-permissions";
import { hasPermission } from "@/lib/permissions/check";
import type { RolePermissions } from "@/lib/permissions/catalog";

type ViewId =
  | "selector"
  | "event"
  | "business"
  | "mosque"
  | "article"
  | "articleCategory"
  | "eventCategory"
  | "businessCategory"
  | "businessAmenity"
  | "businessCertBody"
  | "mosqueFacility";

export const QUICK_CREATE_OPEN_EVENT = "quick-create:open";

interface QuickCreateOpenDetail {
  view?: Exclude<ViewId, "selector">;
  /** When set with view="mosque", opens UAPOP in edit mode pre-filled with this mosque. */
  mosque?: Mosque;
}

export function openQuickCreate(view?: Exclude<ViewId, "selector">) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<QuickCreateOpenDetail>(QUICK_CREATE_OPEN_EVENT, { detail: { view } }),
  );
}

export function openQuickEditMosque(mosque: Mosque) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<QuickCreateOpenDetail>(QUICK_CREATE_OPEN_EVENT, {
      detail: { view: "mosque", mosque },
    }),
  );
}

interface QuickCreateProps {
  categories: BusinessCategory[];
  eventCategories: EventCategoryDoc[];
  articleCategories: ArticleCategoryDoc[];
  mosqueFacilities: MosqueFacility[];
  canPersist: boolean;
  adminEmail: string;
}

interface QuickCreateItem {
  id: Exclude<ViewId, "selector">;
  icon: LucideIcon;
  nameKey:
    | "event"
    | "business"
    | "mosque"
    | "article"
    | "articleCategory"
    | "eventCategory"
    | "businessCategory"
    | "businessAmenity"
    | "businessCertBody"
    | "mosqueFacility";
  shortcut: string;
}

const ITEMS: QuickCreateItem[] = [
  { id: "event", icon: CalendarPlus, nameKey: "event", shortcut: "E" },
  { id: "business", icon: Store, nameKey: "business", shortcut: "B" },
  { id: "mosque", icon: Building2, nameKey: "mosque", shortcut: "M" },
  { id: "article", icon: FileText, nameKey: "article", shortcut: "A" },
  { id: "articleCategory", icon: Tags, nameKey: "articleCategory", shortcut: "C" },
  { id: "eventCategory", icon: Tags, nameKey: "eventCategory", shortcut: "V" },
  { id: "businessCategory", icon: Tags, nameKey: "businessCategory", shortcut: "G" },
  { id: "businessAmenity", icon: ConciergeBell, nameKey: "businessAmenity", shortcut: "Y" },
  { id: "businessCertBody", icon: BadgeCheck, nameKey: "businessCertBody", shortcut: "F" },
  { id: "mosqueFacility", icon: ConciergeBell, nameKey: "mosqueFacility", shortcut: "Q" },
];

export function QuickCreate({
  categories,
  eventCategories,
  articleCategories,
  mosqueFacilities,
  canPersist,
  adminEmail,
}: QuickCreateProps) {
  const router = useRouter();
  const t = useTranslations("quickCreate");
  const tTypes = useTranslations("quickCreate.types");
  const tFormTitles = useTranslations("quickCreate.formTitles");
  const tMosqueAdmin = useTranslations("mosquesAdmin.form");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewId>("selector");
  const [editMosque, setEditMosque] = useState<Mosque | null>(null);
  const permissions = usePermissions();
  const visibleItems = useMemo(
    () => ITEMS.filter((item) => hasPermission(permissions, CREATE_PERMISSION[item.id])),
    [permissions],
  );

  function close() {
    setOpen(false);
  }

  function back() {
    setView("selector");
    setEditMosque(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset to selector for next open. Defer slightly so the close animation
      // doesn't visually flicker through the selector before fading out.
      setTimeout(() => {
        setView("selector");
        setEditMosque(null);
      }, 150);
    }
  }

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<QuickCreateOpenDetail>).detail;
      const v = detail?.view;
      // Block create requests the user lacks permission for. The mosque "edit"
      // path (openQuickEditMosque) sets detail.mosque and is governed by its
      // own entry point, so let it through.
      if (v && !detail?.mosque && !hasPermission(permissions, CREATE_PERMISSION[v])) {
        return;
      }
      setView(v ?? "selector");
      setEditMosque(detail?.mosque ?? null);
      setOpen(true);
    }
    window.addEventListener(QUICK_CREATE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(QUICK_CREATE_OPEN_EVENT, onOpen);
  }, [permissions]);

  const isForm = view !== "selector";

  // Nothing creatable for this role → no "+" affordance at all.
  if (visibleItems.length === 0) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("trigger")}
        title={t("trigger")}
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
      </Button>

      <EditorDialog open={open} onOpenChange={handleOpenChange}>
        <EditorDialogContent
          className={cn(
            "w-[92vw] rounded-2xl",
            isForm
              ? view === "article" ||
                view === "articleCategory" ||
                view === "eventCategory" ||
                view === "businessCategory" ||
                view === "businessAmenity" ||
                view === "businessCertBody"
                ? "h-[80vh] max-h-[80vh] max-w-[1200px]"
                : "h-[80vh] max-h-[80vh] max-w-3xl"
              : "h-auto max-h-[80vh] max-w-2xl sm:max-h-[80vh]",
          )}
          hideClose={!isForm}
          onEscapeKeyDown={(e) => {
            if (isForm) {
              e.preventDefault();
              back();
            }
          }}
        >
          {!isForm ? (
            <SelectorView
              items={visibleItems}
              onSelect={(id) => setView(id)}
              t={t}
              tTypes={tTypes}
            />
          ) : (
            <FormView
              view={view}
              permissions={permissions}
              onBack={back}
              onClose={close}
              backLabel={t("back")}
              titleFor={(v) =>
                v === "mosque" && editMosque
                  ? `${tMosqueAdmin("editTitle")} — ${editMosque.name.en}`
                  : tFormTitles(v)
              }
              categories={categories}
              eventCategories={eventCategories}
              articleCategories={articleCategories}
              mosqueFacilities={mosqueFacilities}
              canPersist={canPersist}
              adminEmail={adminEmail}
              editMosque={editMosque}
              router={router}
            />
          )}
        </EditorDialogContent>
      </EditorDialog>
    </>
  );
}

function SelectorView({
  items: sourceItems,
  onSelect,
  t,
  tTypes,
}: {
  items: QuickCreateItem[];
  onSelect: (id: Exclude<ViewId, "selector">) => void;
  t: ReturnType<typeof useTranslations>;
  tTypes: ReturnType<typeof useTranslations>;
}) {
  const items = useMemo(
    () =>
      sourceItems.map((item) => ({
        ...item,
        name: tTypes(`${item.nameKey}.name`),
        description: tTypes(`${item.nameKey}.description`),
      })),
    [sourceItems, tTypes],
  );
  return (
    <Command className="rounded-2xl bg-transparent">
      <EditorDialogTitle className="sr-only">{t("title")}</EditorDialogTitle>
      <CommandInput
        placeholder={t("searchPlaceholder")}
        autoFocus
        className="h-12 text-[15px]"
      />
      <CommandList className="max-h-[60vh] p-2">
        <CommandEmpty>{t("empty")}</CommandEmpty>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <CommandItem
              key={item.id}
              value={`${item.name} ${item.description}`}
              onSelect={() => onSelect(item.id)}
              className="my-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground">
                <Icon className="size-[18px]" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold text-foreground">{item.name}</span>
                <span className="truncate text-xs text-muted-foreground">{item.description}</span>
              </span>
              <kbd className="ml-auto inline-flex size-6 select-none items-center justify-center rounded-md border border-border bg-background font-mono text-[11px] font-medium text-muted-foreground">
                {item.shortcut}
              </kbd>
            </CommandItem>
          );
        })}
      </CommandList>
    </Command>
  );
}

function FormView({
  view,
  permissions,
  onBack,
  onClose,
  backLabel,
  titleFor,
  categories,
  eventCategories,
  articleCategories,
  mosqueFacilities,
  canPersist,
  adminEmail,
  editMosque,
  router,
}: {
  view: Exclude<ViewId, "selector">;
  permissions: RolePermissions;
  onBack: () => void;
  onClose: () => void;
  backLabel: string;
  titleFor: (view: Exclude<ViewId, "selector">) => string;
  categories: BusinessCategory[];
  eventCategories: EventCategoryDoc[];
  articleCategories: ArticleCategoryDoc[];
  mosqueFacilities: MosqueFacility[];
  canPersist: boolean;
  adminEmail: string;
  editMosque: Mosque | null;
  router: ReturnType<typeof useRouter>;
}) {
  // Defense in depth: never render a create form the user lacks permission for.
  // The mosque "edit" case (editMosque set) is governed by its own entry point.
  if (!(view === "mosque" && editMosque) && !hasPermission(permissions, CREATE_PERMISSION[view])) {
    return null;
  }

  const BackButton = (
    <button
      type="button"
      onClick={onBack}
      aria-label={backLabel}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="size-4" />
    </button>
  );

  if (view === "event") {
    return (
      <FormShell backButton={BackButton} title={titleFor("event")} fillHeight>
        <SubmitEventForm
          adminMode
          categories={eventCategories}
          userEmail={adminEmail}
          onAdminSaved={() => {
            onClose();
            router.refresh();
          }}
          onAdminCancel={onClose}
        />
      </FormShell>
    );
  }

  if (view === "business") {
    return (
      <FormShell backButton={BackButton} title={titleFor("business")} fillHeight>
        <SubmitBusinessForm
          adminMode
          categories={categories}
          userEmail={adminEmail}
          onAdminSaved={() => {
            onClose();
            router.refresh();
          }}
          onAdminCancel={onClose}
        />
      </FormShell>
    );
  }

  if (view === "mosque") {
    return (
      <FormShell backButton={BackButton} title={titleFor("mosque")} fillHeight>
        <SubmitMosqueForm
          adminMode
          mode={editMosque ? "edit" : "create"}
          initial={editMosque ?? undefined}
          facilities={mosqueFacilities}
          userEmail={adminEmail}
          onAdminSaved={() => {
            onClose();
            router.refresh();
          }}
          onAdminCancel={onClose}
        />
      </FormShell>
    );
  }

  if (view === "article") {
    return (
      <FormShell backButton={BackButton} title={titleFor("article")} fillHeight>
        <ArticleEditorClient
          article={null}
          source={canPersist ? "firestore" : "mock"}
          categories={articleCategories}
          layout="dialog"
          onSaved={({ id }) => {
            onClose();
            router.push(`/admin/articles/${id}`);
          }}
          onCancel={onClose}
        />
      </FormShell>
    );
  }

  if (view === "articleCategory") {
    return (
      <FormShell
        backButton={BackButton}
        title={titleFor("articleCategory")}
        fillHeight
      >
        <ArticleCategoryForm
          category={null}
          canPersist={canPersist}
          onSaved={() => {
            onClose();
            router.push("/admin/articles/categories");
            router.refresh();
          }}
          onCancel={onClose}
        />
      </FormShell>
    );
  }

  if (view === "eventCategory") {
    return (
      <FormShell
        backButton={BackButton}
        title={titleFor("eventCategory")}
        fillHeight
      >
        <EventCategoryForm
          category={null}
          canPersist={canPersist}
          onSaved={() => {
            onClose();
            router.push("/admin/events/categories");
            router.refresh();
          }}
          onCancel={onClose}
        />
      </FormShell>
    );
  }

  if (view === "businessCategory") {
    return (
      <FormShell
        backButton={BackButton}
        title={titleFor("businessCategory")}
        fillHeight
      >
        <BusinessCategoryForm
          category={null}
          canPersist={canPersist}
          onSaved={() => {
            onClose();
            router.push("/admin/businesses/categories");
            router.refresh();
          }}
          onCancel={onClose}
        />
      </FormShell>
    );
  }

  if (view === "businessAmenity") {
    return (
      <FormShell
        backButton={BackButton}
        title={titleFor("businessAmenity")}
        fillHeight
      >
        <BusinessAmenityForm
          amenity={null}
          canPersist={canPersist}
          onSaved={() => {
            onClose();
            router.push("/admin/businesses/amenities");
            router.refresh();
          }}
          onCancel={onClose}
        />
      </FormShell>
    );
  }

  if (view === "businessCertBody") {
    return (
      <FormShell
        backButton={BackButton}
        title={titleFor("businessCertBody")}
        fillHeight
      >
        <CertBodyForm
          certBody={null}
          canPersist={canPersist}
          onSaved={() => {
            onClose();
            router.push("/admin/businesses/cert-bodies");
            router.refresh();
          }}
          onCancel={onClose}
        />
      </FormShell>
    );
  }

  if (view === "mosqueFacility") {
    return (
      <FormShell backButton={BackButton} title={titleFor("mosqueFacility")} fillHeight>
        <MosqueFacilityForm
          facility={null}
          canPersist={canPersist}
          onSaved={() => {
            onClose();
            router.push("/admin/mosques/facilities");
            router.refresh();
          }}
          onCancel={onClose}
        />
      </FormShell>
    );
  }

  return null;
}

/**
 * Wraps the form contents with a flex header (back button + title) and a
 * scrollable body. Replaces the previous absolute-positioned back button so
 * the header doesn't overlap the form's own title.
 */
function FormShell({
  backButton,
  title,
  children,
  fillHeight = false,
}: {
  backButton: React.ReactNode;
  title: string;
  children: React.ReactNode;
  /**
   * When true, the body wrapper is bare (no padding, no scroll) so the form
   * itself can be a `flex h-full flex-col` container with its own internal
   * scrolling step content and a non-scrolling footer pinned to the bottom.
   * When false (default), FormShell provides padding + vertical scroll —
   * suited to forms that don't manage their own layout.
   */
  fillHeight?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 pe-12">
        {backButton}
        <EditorDialogTitle className="truncate text-base font-semibold text-foreground">
          {title}
        </EditorDialogTitle>
      </div>
      <div
        className={
          fillHeight
            ? "flex-1 min-h-0 overflow-hidden"
            : "flex-1 min-h-0 overflow-y-auto px-4 py-4 md:px-6"
        }
      >
        {children}
      </div>
    </div>
  );
}
