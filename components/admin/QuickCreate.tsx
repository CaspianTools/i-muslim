"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Building2,
  CalendarPlus,
  FileText,
  type LucideIcon,
  Plus,
  Store,
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
import { MosqueForm } from "./mosques/MosqueForm";
import { ArticleEditorClient } from "./articles/ArticleEditorClient";
import type { BusinessCategory } from "@/types/business";

type ViewId = "selector" | "event" | "business" | "mosque" | "article";

interface QuickCreateProps {
  categories: BusinessCategory[];
  canPersist: boolean;
  adminEmail: string;
}

interface QuickCreateItem {
  id: Exclude<ViewId, "selector">;
  icon: LucideIcon;
  nameKey: "event" | "business" | "mosque" | "article";
  shortcut: string;
}

const ITEMS: QuickCreateItem[] = [
  { id: "event", icon: CalendarPlus, nameKey: "event", shortcut: "E" },
  { id: "business", icon: Store, nameKey: "business", shortcut: "B" },
  { id: "mosque", icon: Building2, nameKey: "mosque", shortcut: "M" },
  { id: "article", icon: FileText, nameKey: "article", shortcut: "A" },
];

export function QuickCreate({ categories, canPersist, adminEmail }: QuickCreateProps) {
  const router = useRouter();
  const t = useTranslations("quickCreate");
  const tTypes = useTranslations("quickCreate.types");
  const tFormTitles = useTranslations("quickCreate.formTitles");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewId>("selector");

  function close() {
    setOpen(false);
  }

  function back() {
    setView("selector");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset to selector for next open. Defer slightly so the close animation
      // doesn't visually flicker through the selector before fading out.
      setTimeout(() => setView("selector"), 150);
    }
  }

  const isForm = view !== "selector";

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
            !isForm &&
              "h-auto max-h-[80vh] w-[92vw] max-w-2xl rounded-2xl sm:max-h-[80vh]",
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
              onSelect={(id) => setView(id)}
              t={t}
              tTypes={tTypes}
            />
          ) : (
            <FormView
              view={view}
              onBack={back}
              onClose={close}
              backLabel={t("back")}
              titleFor={(v) => tFormTitles(v)}
              categories={categories}
              canPersist={canPersist}
              adminEmail={adminEmail}
              router={router}
            />
          )}
        </EditorDialogContent>
      </EditorDialog>
    </>
  );
}

function SelectorView({
  onSelect,
  t,
  tTypes,
}: {
  onSelect: (id: Exclude<ViewId, "selector">) => void;
  t: ReturnType<typeof useTranslations>;
  tTypes: ReturnType<typeof useTranslations>;
}) {
  const items = useMemo(
    () =>
      ITEMS.map((item) => ({
        ...item,
        name: tTypes(`${item.nameKey}.name`),
        description: tTypes(`${item.nameKey}.description`),
      })),
    [tTypes],
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
  onBack,
  onClose,
  backLabel,
  titleFor,
  categories,
  canPersist,
  adminEmail,
  router,
}: {
  view: Exclude<ViewId, "selector">;
  onBack: () => void;
  onClose: () => void;
  backLabel: string;
  titleFor: (view: Exclude<ViewId, "selector">) => string;
  categories: BusinessCategory[];
  canPersist: boolean;
  adminEmail: string;
  router: ReturnType<typeof useRouter>;
}) {
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
      <FormShell backButton={BackButton} title={titleFor("event")}>
        <SubmitEventForm
          adminMode
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
      <FormShell backButton={BackButton} title={titleFor("business")}>
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
      <FormShell backButton={BackButton} title={titleFor("mosque")}>
        <MosqueForm
          mode="create"
          onSaved={({ slug }) => {
            onClose();
            if (slug) {
              router.push(`/admin/mosques/${slug}/edit`);
            } else {
              router.refresh();
            }
          }}
          onCancel={onClose}
        />
      </FormShell>
    );
  }

  if (view === "article") {
    return (
      <FormShell backButton={BackButton} title={titleFor("article")}>
        <ArticleEditorClient
          article={null}
          source={canPersist ? "firestore" : "mock"}
          onSaved={({ id }) => {
            onClose();
            router.push(`/admin/articles/${id}`);
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
}: {
  backButton: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 pe-12">
        {backButton}
        <EditorDialogTitle className="truncate text-base font-semibold text-foreground">
          {title}
        </EditorDialogTitle>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 md:px-6">
        {children}
      </div>
    </div>
  );
}
