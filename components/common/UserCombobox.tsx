"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronsUpDown, Loader2, UserPlus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  listManagerCandidatesAction,
  type ManagerCandidate,
} from "@/app/[locale]/(admin)/admin/mosques/actions";

interface Props {
  /** Called when a user is picked. The popover closes afterwards. */
  onSelect: (user: ManagerCandidate) => void;
  /** uids to hide from the list (e.g. already-assigned managers). */
  excludeIds?: string[];
  id?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Searchable picker over all registered users. Lazily loads the full list the
 * first time it opens (admin user base is bounded; same approach as the admin
 * Users page) and filters client-side via the Command input.
 */
export function UserCombobox({ onSelect, excludeIds = [], id, disabled, className }: Props) {
  const t = useTranslations("userCombobox");
  const [open, setOpen] = React.useState(false);
  const [users, setUsers] = React.useState<ManagerCandidate[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  // Lazy-load the user list the first time the popover opens. Triggered from
  // onOpenChange (not an effect) to avoid cascading setState-in-effect renders.
  function loadUsersOnce() {
    if (users || loading) return;
    setLoading(true);
    setError(false);
    listManagerCandidatesAction()
      .then((res) => {
        if (res.ok) setUsers(res.data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  const excluded = new Set(excludeIds);
  const visible = (users ?? []).filter((u) => !excluded.has(u.uid));

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (disabled) return;
        setOpen(o);
        if (o) loadUsersOnce();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className="truncate text-start text-muted-foreground">{t("placeholder")}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(28rem,90vw)] p-0">
        <Command>
          <CommandInput placeholder={t("searchPlaceholder")} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {t("loading")}
              </div>
            ) : error ? (
              <div className="py-6 text-center text-sm text-danger">{t("loadError")}</div>
            ) : (
              <>
                <CommandEmpty>{t("noResults")}</CommandEmpty>
                <CommandGroup>
                  {visible.map((u) => (
                    <CommandItem
                      key={u.uid}
                      value={`${u.name} ${u.email}`}
                      onSelect={() => {
                        onSelect(u);
                        setOpen(false);
                      }}
                      className="flex cursor-pointer items-center gap-2 px-2 py-2"
                    >
                      <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        {u.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatarUrl} alt="" className="size-full object-cover" />
                        ) : (
                          (u.name.charAt(0) || u.email.charAt(0) || "?").toUpperCase()
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm text-foreground">{u.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{u.email}</span>
                      </span>
                      <UserPlus className="size-4 shrink-0 text-muted-foreground" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
