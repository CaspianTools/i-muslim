"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Copy, Check, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { API_PERMISSIONS, API_SCOPES } from "@/types/api";
import type {
  ApiKeyCreatedDto,
  ApiKeyDto,
  ApiPermission,
  ApiScope,
} from "@/types/api";

interface Props {
  initialKeys: ApiKeyDto[];
}

export function ApiKeysPageClient({ initialKeys }: Props) {
  const t = useTranslations("apiKeys");
  const tCommon = useTranslations("common");
  const [keys, setKeys] = useState<ApiKeyDto[]>(initialKeys);
  const [createOpen, setCreateOpen] = useState(false);
  const [revealed, setRevealed] = useState<ApiKeyCreatedDto | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCreated(created: ApiKeyCreatedDto) {
    const { key: _key, ...dto } = created;
    void _key;
    setKeys((prev) => [dto, ...prev]);
    setRevealed(created);
  }

  async function revoke(id: string) {
    if (!confirm(t("confirmRevoke"))) return;
    const res = await fetch(`/api/admin/api-keys/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(t("revokeFailed"));
      return;
    }
    setKeys((prev) =>
      prev.map((k) =>
        k.id === id ? { ...k, status: "revoked", revokedAt: new Date().toISOString() } : k,
      ),
    );
    toast.success(t("revokedToast"));
  }

  async function copyKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> {t("create")}
        </Button>
      </div>

      {keys.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <KeyRound className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t("col.name")}</th>
                <th className="px-4 py-2 font-medium">{t("col.prefix")}</th>
                <th className="px-4 py-2 font-medium">{t("col.scopes")}</th>
                <th className="px-4 py-2 font-medium">{t("col.permissions")}</th>
                <th className="px-4 py-2 font-medium">{t("col.status")}</th>
                <th className="px-4 py-2 font-medium">{t("col.lastUsed")}</th>
                <th className="px-4 py-2 font-medium">{t("col.requests")}</th>
                <th className="px-4 py-2 font-medium text-right">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-2 font-medium">{k.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {k.keyPrefix}…
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <Badge key={s} variant="info">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {k.permissions.map((p) => (
                        <Badge
                          key={p}
                          variant={p === "delete" ? "danger" : p === "write" ? "warning" : "neutral"}
                        >
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={k.status === "active" ? "success" : "neutral"}>
                      {k.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">
                    {k.requestCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {k.status === "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => revoke(k.id)}
                        aria-label={t("revoke")}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />

      <Dialog open={Boolean(revealed)} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("revealedTitle")}</DialogTitle>
            <DialogDescription>{t("revealedWarning")}</DialogDescription>
          </DialogHeader>
          {revealed && (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-muted p-3 font-mono text-xs break-all">
                {revealed.key}
              </div>
              <Button
                onClick={() => copyKey(revealed.key)}
                variant="secondary"
                className="w-full"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? tCommon("copy") + " ✓" : tCommon("copy")}
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setRevealed(null)}>{tCommon("close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CreateKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (created: ApiKeyCreatedDto) => void;
}

function CreateKeyDialog({ open, onOpenChange, onCreated }: CreateKeyDialogProps) {
  const t = useTranslations("apiKeys");
  const tCommon = useTranslations("common");
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<ApiScope>>(new Set(["*"]));
  const [permissions, setPermissions] = useState<Set<ApiPermission>>(new Set(["read"]));
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  function toggleScope(s: ApiScope) {
    setScopes((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function togglePermission(p: ApiPermission) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function reset() {
    setName("");
    setScopes(new Set(["*"]));
    setPermissions(new Set(["read"]));
    setExpiresAt("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (scopes.size === 0 || permissions.size === 0 || !name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scopes: Array.from(scopes),
          permissions: Array.from(permissions),
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? body?.error ?? "create failed");
      onCreated(body.data as ApiKeyCreatedDto);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("createTitle")}</DialogTitle>
            <DialogDescription>{t("createDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="api-key-name">{t("nameLabel")}</Label>
            <Input
              id="api-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              required
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("scopesLabel")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {API_SCOPES.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={scopes.has(s)}
                    onCheckedChange={() => toggleScope(s)}
                  />
                  <span className="font-mono text-xs">{s}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("permissionsLabel")}</Label>
            <div className="flex gap-4">
              {API_PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={permissions.has(p)}
                    onCheckedChange={() => togglePermission(p)}
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="api-key-expires">{t("expiresLabel")}</Label>
            <Input
              id="api-key-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("expiresHint")}</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? tCommon("working") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
