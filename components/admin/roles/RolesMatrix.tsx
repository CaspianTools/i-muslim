"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  ALL_ACTIONS_ORDERED,
  PERMISSION_RESOURCES,
  WILDCARD,
  actionLabel,
  resourceHasAction,
  type Permission,
  type PermissionResource,
} from "@/lib/permissions/catalog";
import type { AdminRoleDoc } from "@/lib/admin/data/roles";
import {
  createRoleAction,
  deleteRoleAction,
  updateRoleAction,
} from "@/app/[locale]/(admin)/admin/roles/_actions";

interface Props {
  initialRoles: AdminRoleDoc[];
  canManage: boolean;
}

const RESOURCES = Object.keys(PERMISSION_RESOURCES) as PermissionResource[];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 41);
}

function permsToList(role: AdminRoleDoc): Permission[] {
  return role.permissions === WILDCARD ? [] : [...role.permissions];
}

export function RolesMatrix({ initialRoles, canManage }: Props) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [activeId, setActiveId] = useState<string>(initialRoles[0]?.id ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [savingPerm, startSavingPerm] = useTransition();

  const activeRole = useMemo(
    () => roles.find((r) => r.id === activeId) ?? roles[0] ?? null,
    [roles, activeId],
  );
  const isWildcard = activeRole?.permissions === WILDCARD;
  const editable = canManage && !!activeRole && !activeRole.protected && !isWildcard;

  function patchRole(updated: AdminRoleDoc) {
    setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  function togglePermission(perm: Permission, currentlyOn: boolean) {
    if (!activeRole || !editable) return;
    const current = permsToList(activeRole);
    const next = currentlyOn
      ? current.filter((p) => p !== perm)
      : [...current, perm];

    // Optimistic update.
    const optimistic: AdminRoleDoc = { ...activeRole, permissions: next };
    patchRole(optimistic);

    startSavingPerm(async () => {
      const res = await updateRoleAction(activeRole.id, { permissions: next });
      if (!res.ok) {
        // Revert on failure.
        patchRole(activeRole);
        toast.error(res.error);
        return;
      }
      patchRole(res.data);
    });
  }

  function handleDelete() {
    if (!activeRole) return;
    setDeleteOpen(false);
    const target = activeRole;
    startSavingPerm(async () => {
      const res = await deleteRoleAction(target.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRoles((prev) => {
        const next = prev.filter((r) => r.id !== target.id);
        if (next.length > 0) setActiveId(next[0]!.id);
        return next;
      });
      toast.success(`Deleted role "${target.name}".`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles & permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a role on the left, then toggle the cells below to grant or revoke
            permissions. Changes save automatically.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New role
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        {roles.map((r) => {
          const active = r.id === activeId;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveId(r.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {r.protected && <ShieldCheck className="size-3.5 text-amber-500" />}
              <span className="font-medium">{r.name}</span>
              {(r.memberCount ?? 0) > 0 && (
                <span
                  className={cn(
                    "ms-1 rounded-full px-1.5 py-0 text-[10px] tabular-nums",
                    active ? "bg-primary/20" : "bg-muted",
                  )}
                >
                  {r.memberCount}
                </span>
              )}
            </button>
          );
        })}
        {roles.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No roles yet. Run <code className="rounded bg-muted px-1 py-0.5 font-mono">npm run seed:roles</code>{" "}
            or click <strong>New role</strong>.
          </p>
        )}
      </div>

      {activeRole && (
        <RoleMetaPanel
          key={activeRole.id}
          role={activeRole}
          canManage={canManage}
          onUpdated={patchRole}
          onDeleteClick={() => setDeleteOpen(true)}
        />
      )}

      {activeRole && (
        <PermissionMatrix
          role={activeRole}
          editable={editable}
          isWildcard={!!isWildcard}
          savingPerm={savingPerm}
          onToggle={togglePermission}
        />
      )}

      <NewRoleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingIds={new Set(roles.map((r) => r.id))}
        onCreated={(role) => {
          setRoles((prev) => [...prev, role]);
          setActiveId(role.id);
          setCreateOpen(false);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete role "${activeRole?.name}"?`}
        description="This cannot be undone. Users assigned this role must be reassigned first."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ── Meta panel ─────────────────────────────────────────────────────────────
// Inline name + description editor for the active role. Debounced to ~300ms
// so each keystroke doesn't fire a network request. Keyed on role.id by the
// parent so switching roles remounts cleanly.

function RoleMetaPanel({
  role,
  canManage,
  onUpdated,
  onDeleteClick,
}: {
  role: AdminRoleDoc;
  canManage: boolean;
  onUpdated: (r: AdminRoleDoc) => void;
  onDeleteClick: () => void;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialKeyRef = useRef(JSON.stringify({ n: role.name, d: role.description }));

  const editable = canManage && !role.protected;

  useEffect(() => {
    if (!editable) return;
    const currentKey = JSON.stringify({ n: name, d: description });
    if (currentKey === initialKeyRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await updateRoleAction(role.id, { name, description });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        initialKeyRef.current = JSON.stringify({
          n: res.data.name,
          d: res.data.description,
        });
        onUpdated(res.data);
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, description, role.id, editable, onUpdated]);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="space-y-1">
            <Label htmlFor="role-name" className="text-xs uppercase tracking-wide text-muted-foreground">
              Name
            </Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!editable}
              className="text-base font-semibold"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="role-description" className="text-xs uppercase tracking-wide text-muted-foreground">
              Description
            </Label>
            <textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!editable}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{role.id}</code>
            {role.builtIn && <Badge variant="neutral" className="text-[10px] uppercase tracking-wide">Built-in</Badge>}
            {role.protected && <Badge variant="warning" className="text-[10px] uppercase tracking-wide">Protected</Badge>}
            <span>·</span>
            <span>{role.memberCount ?? 0} member{(role.memberCount ?? 0) === 1 ? "" : "s"}</span>
            {pending && <span className="text-primary">· saving…</span>}
          </div>
        </div>
        {canManage && !role.builtIn && !role.protected && (
          <Button variant="ghost" size="icon" aria-label={`Delete role ${role.name}`} onClick={onDeleteClick}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        )}
      </div>
      {role.protected && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          This role is protected. Permissions and assignment are managed by the
          <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">npm run seed:roles</code>
          script.
        </p>
      )}
    </div>
  );
}

// ── The matrix ─────────────────────────────────────────────────────────────

function PermissionMatrix({
  role,
  editable,
  isWildcard,
  savingPerm,
  onToggle,
}: {
  role: AdminRoleDoc;
  editable: boolean;
  isWildcard: boolean;
  savingPerm: boolean;
  onToggle: (perm: Permission, currentlyOn: boolean) => void;
}) {
  const grantedSet = useMemo<Set<string>>(() => {
    if (role.permissions === WILDCARD) return new Set();
    return new Set(role.permissions);
  }, [role]);

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="sticky start-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">
              Resource
            </th>
            {ALL_ACTIONS_ORDERED.map((action) => (
              <th key={action} className="px-2 py-2 text-center font-medium">
                {actionLabel(action)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((resource) => {
            const def = PERMISSION_RESOURCES[resource];
            return (
              <tr key={resource} className="border-t border-border">
                <th
                  scope="row"
                  className="sticky start-0 z-10 bg-card px-3 py-2 text-left align-middle"
                >
                  <div className="font-medium text-foreground">{def.label}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{resource}</div>
                </th>
                {ALL_ACTIONS_ORDERED.map((action) => {
                  const applicable = resourceHasAction(resource, action);
                  if (!applicable) {
                    return (
                      <td key={action} className="px-2 py-2 text-center align-middle text-muted-foreground/40">
                        –
                      </td>
                    );
                  }
                  const perm = `${resource}.${action}` as Permission;
                  const granted = isWildcard || grantedSet.has(perm);
                  return (
                    <td key={action} className="px-1.5 py-1 text-center align-middle">
                      <Cell
                        granted={granted}
                        disabled={!editable || savingPerm}
                        onToggle={() => onToggle(perm, granted)}
                        ariaLabel={`${actionLabel(action)} on ${def.label}`}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({
  granted,
  disabled,
  onToggle,
  ariaLabel,
}: {
  granted: boolean;
  disabled: boolean;
  onToggle: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={granted}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        granted
          ? "border-success/40 bg-success/15 text-success"
          : "border-border text-muted-foreground/50 hover:border-primary/50 hover:bg-muted",
        disabled && "cursor-not-allowed opacity-60 hover:border-border hover:bg-transparent",
      )}
    >
      {granted ? "✓" : "·"}
    </button>
  );
}

// ── New role dialog ────────────────────────────────────────────────────────

function NewRoleDialog({
  open,
  onOpenChange,
  existingIds,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingIds: Set<string>;
  onCreated: (role: AdminRoleDoc) => void;
}) {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const effectiveId = idTouched ? id : slugify(name);
  const idCollides = effectiveId.length > 0 && existingIds.has(effectiveId);

  function reset() {
    setName("");
    setId("");
    setIdTouched(false);
    setDescription("");
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !effectiveId) return;
    setSubmitting(true);
    const r = await createRoleAction({
      id: effectiveId,
      name: name.trim(),
      description: description.trim() || undefined,
      permissions: [],
    });
    setSubmitting(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`Created role "${r.data.name}".`);
    reset();
    onCreated(r.data);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New role</DialogTitle>
          <DialogDescription>
            Create a custom role. Toggle its permissions in the matrix once it&apos;s active.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-role-name">Name</Label>
            <Input
              id="new-role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Russian translator"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-role-id">Id</Label>
            <Input
              id="new-role-id"
              value={effectiveId}
              onChange={(e) => {
                setId(e.target.value);
                setIdTouched(true);
              }}
              placeholder="russian-translator"
              pattern="[a-z0-9][a-z0-9-]{1,40}"
              required
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, digits, and hyphens. Used in code and the URL.
            </p>
            {idCollides && (
              <p className="text-xs text-destructive">
                A role with this id already exists.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-role-description">Description</Label>
            <Input
              id="new-role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Translates Hadith and Quran into Russian"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || idCollides || !name.trim() || !effectiveId}>
              {submitting ? "Creating…" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
