"use client";

import { useMemo, useState, useTransition } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { toast } from "@/components/ui/sonner";
import { WILDCARD } from "@/lib/permissions/catalog";
import type { AdminRoleDoc } from "@/lib/admin/data/roles";
import {
  createRoleAction,
  deleteRoleAction,
} from "@/app/[locale]/(admin)/admin/roles/_actions";

interface Props {
  initialRoles: AdminRoleDoc[];
  canManage: boolean;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 41);
}

function permissionCount(role: AdminRoleDoc): string {
  if (role.permissions === WILDCARD) return "All";
  return String(role.permissions.length);
}

export function RolesList({ initialRoles, canManage }: Props) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminRoleDoc | null>(null);
  const [isPending, startTransition] = useTransition();

  const sorted = useMemo(() => roles, [roles]);

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const r = await deleteRoleAction(target.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setRoles((prev) => prev.filter((x) => x.id !== target.id));
      toast.success(`Deleted role "${target.name}".`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles & permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define what each role can see and do. Assign roles to users on the{" "}
            <Link href="/admin/users" className="text-primary hover:underline">
              Users
            </Link>{" "}
            page.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New role
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Role</th>
              <th className="px-4 py-2 text-left font-medium">Description</th>
              <th className="px-4 py-2 text-right font-medium">Permissions</th>
              <th className="px-4 py-2 text-right font-medium">Members</th>
              <th className="px-4 py-2 text-right font-medium" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((role) => (
              <tr
                key={role.id}
                className="border-t border-border hover:bg-muted/20 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/roles/${role.id}`}
                    className="flex items-center gap-2 font-medium hover:underline"
                  >
                    {role.protected && (
                      <ShieldCheck
                        className="size-4 text-amber-500"
                        aria-label="Protected"
                      />
                    )}
                    {role.name}
                  </Link>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1 py-0.5 font-mono">{role.id}</code>
                    {role.builtIn && (
                      <Badge variant="neutral" className="text-[10px] uppercase tracking-wide">
                        Built-in
                      </Badge>
                    )}
                    {role.protected && (
                      <Badge variant="warning" className="text-[10px] uppercase tracking-wide">
                        Protected
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-md">
                  {role.description || <span className="italic opacity-60">No description</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{permissionCount(role)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{role.memberCount ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  {canManage && !role.builtIn && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete role ${role.name}`}
                      disabled={isPending}
                      onClick={() => setDeleteTarget(role)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No roles found. Run <code className="rounded bg-muted px-1 py-0.5 font-mono">npm run seed:roles</code> to seed built-in roles.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <NewRoleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingIds={new Set(roles.map((r) => r.id))}
        onCreated={(role) => {
          setCreateOpen(false);
          router.push(`/admin/roles/${role.id}`);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete role "${deleteTarget?.name}"?`}
        description="This cannot be undone. Users assigned this role must be reassigned first."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}

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
            Create a custom role. You can pick its permissions on the next screen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Russian translator"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-id">Id</Label>
            <Input
              id="role-id"
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
            <Label htmlFor="role-description">Description</Label>
            <Input
              id="role-description"
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
