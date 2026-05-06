"use client";

import { useMemo, useState, useTransition } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import {
  PERMISSION_RESOURCES,
  WILDCARD,
  actionLabel,
  type Permission,
  type PermissionResource,
} from "@/lib/permissions/catalog";
import type { AdminRoleDoc } from "@/lib/admin/data/roles";
import { updateRoleAction } from "@/app/[locale]/(admin)/admin/roles/_actions";

interface Props {
  role: AdminRoleDoc;
  canManage: boolean;
}

function permListToSet(perms: AdminRoleDoc["permissions"]): Set<Permission> {
  if (perms === WILDCARD) return new Set();
  return new Set(perms);
}

export function RoleEditor({ role, canManage }: Props) {
  const router = useRouter();
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [perms, setPerms] = useState<Set<Permission>>(() => permListToSet(role.permissions));
  const [isPending, startTransition] = useTransition();

  const isWildcard = role.permissions === WILDCARD;
  const editable = canManage && !role.protected;

  const initialKey = useMemo(() => {
    return JSON.stringify({
      n: role.name,
      d: role.description,
      p: role.permissions === WILDCARD ? "*" : [...role.permissions].sort(),
    });
  }, [role]);

  const currentKey = JSON.stringify({
    n: name,
    d: description,
    p: [...perms].sort(),
  });

  const dirty = currentKey !== initialKey;

  function togglePermission(perm: Permission, on: boolean) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (on) next.add(perm);
      else next.delete(perm);
      return next;
    });
  }

  function toggleResource(resource: PermissionResource, on: boolean) {
    const actions = PERMISSION_RESOURCES[resource].actions;
    setPerms((prev) => {
      const next = new Set(prev);
      for (const action of actions) {
        const perm = `${resource}.${action}` as Permission;
        if (on) next.add(perm);
        else next.delete(perm);
      }
      return next;
    });
  }

  function handleSave() {
    if (!editable) return;
    startTransition(async () => {
      const r = await updateRoleAction(role.id, {
        name: name.trim(),
        description,
        permissions: [...perms],
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Role updated.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/roles"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
          Back to roles
        </Link>
        <div className="mt-2 flex items-center gap-2">
          {role.protected && <ShieldCheck className="size-5 text-amber-500" />}
          <h1 className="text-2xl font-semibold tracking-tight">{role.name}</h1>
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
        <p className="mt-1 text-sm text-muted-foreground">
          <code className="rounded bg-muted px-1 py-0.5 font-mono">{role.id}</code>
        </p>
        {role.protected && (
          <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            This role is protected. Its permissions and assignment are managed by the
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">npm run seed:roles</code>
            script and cannot be edited here.
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_3fr]">
        <section className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!editable}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!editable}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Permissions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isWildcard
              ? "This role grants every current and future permission."
              : "Pick the actions this role can perform across each resource."}
          </p>

          {!isWildcard && (
            <div className="mt-4 divide-y divide-border rounded-lg border border-border">
              {(Object.keys(PERMISSION_RESOURCES) as PermissionResource[]).map((resource) => {
                const def = PERMISSION_RESOURCES[resource];
                const actionList = def.actions;
                const allOn = actionList.every((a) =>
                  perms.has(`${resource}.${a}` as Permission),
                );
                const someOn =
                  !allOn &&
                  actionList.some((a) => perms.has(`${resource}.${a}` as Permission));
                return (
                  <div key={resource} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{def.label}</div>
                      <button
                        type="button"
                        onClick={() => toggleResource(resource, !allOn)}
                        disabled={!editable}
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        {allOn ? "Clear all" : someOn ? "Select all" : "Select all"}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                      {actionList.map((action) => {
                        const perm = `${resource}.${action}` as Permission;
                        const checked = perms.has(perm);
                        return (
                          <label
                            key={action}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => togglePermission(perm, !!v)}
                              disabled={!editable}
                            />
                            <span>{actionLabel(action)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {editable && (
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            variant="secondary"
            disabled={!dirty || isPending}
            onClick={() => {
              setName(role.name);
              setDescription(role.description);
              setPerms(permListToSet(role.permissions));
            }}
          >
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!dirty || isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
