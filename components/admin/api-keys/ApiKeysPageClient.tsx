"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Copy, Check, KeyRound, Trash2, BookOpen } from "lucide-react";
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
import {
  ENDPOINTS,
  renderQuickStart,
  type EndpointEntry,
} from "@/components/admin/api-keys/endpoint-catalog";

interface Props {
  initialKeys: ApiKeyDto[];
}

type CopySlot = "key" | "quickstart" | "reference";

export function ApiKeysPageClient({ initialKeys }: Props) {
  const t = useTranslations("apiKeys");
  const tCommon = useTranslations("common");
  const [keys, setKeys] = useState<ApiKeyDto[]>(initialKeys);
  const [createOpen, setCreateOpen] = useState(false);
  const [revealed, setRevealed] = useState<ApiKeyCreatedDto | null>(null);
  const [endpointsOpen, setEndpointsOpen] = useState(false);
  const [copiedSlot, setCopiedSlot] = useState<CopySlot | null>(null);

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

  async function copyToClipboard(value: string, slot: CopySlot) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedSlot(slot);
      setTimeout(() => setCopiedSlot((prev) => (prev === slot ? null : prev)), 1500);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setEndpointsOpen(true)}>
          <BookOpen className="size-4" /> {t("endpointsButton")}
        </Button>
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

      <RevealKeyDialog
        revealed={revealed}
        onClose={() => {
          setRevealed(null);
          setCopiedSlot(null);
        }}
        copiedSlot={copiedSlot}
        onCopy={copyToClipboard}
      />

      <EndpointsDialog
        open={endpointsOpen}
        onOpenChange={(o) => {
          setEndpointsOpen(o);
          if (!o) setCopiedSlot((prev) => (prev === "reference" ? null : prev));
        }}
        copied={copiedSlot === "reference"}
        onCopy={(value) => copyToClipboard(value, "reference")}
      />
    </div>
  );
}

interface RevealKeyDialogProps {
  revealed: ApiKeyCreatedDto | null;
  onClose: () => void;
  copiedSlot: CopySlot | null;
  onCopy: (value: string, slot: CopySlot) => void;
}

function RevealKeyDialog({ revealed, onClose, copiedSlot, onCopy }: RevealKeyDialogProps) {
  const t = useTranslations("apiKeys");
  const tCommon = useTranslations("common");

  const quickStart = useMemo(() => {
    if (!revealed) return "";
    return renderQuickStart({
      key: revealed.key,
      scopes: revealed.scopes,
      permissions: revealed.permissions,
    });
  }, [revealed]);

  return (
    <Dialog open={Boolean(revealed)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("revealedTitle")}</DialogTitle>
          <DialogDescription>{t("revealedWarning")}</DialogDescription>
        </DialogHeader>
        {revealed && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted p-3 font-mono text-xs break-all">
              {revealed.key}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                onClick={() => onCopy(revealed.key, "key")}
                variant="secondary"
              >
                {copiedSlot === "key" ? <Check className="size-4" /> : <Copy className="size-4" />}
                {t("copyKey")}
                {copiedSlot === "key" ? " ✓" : ""}
              </Button>
              <Button
                onClick={() => onCopy(quickStart, "quickstart")}
              >
                {copiedSlot === "quickstart" ? <Check className="size-4" /> : <Copy className="size-4" />}
                {t("copyKeyWithQuickstart")}
                {copiedSlot === "quickstart" ? " ✓" : ""}
              </Button>
            </div>
            <details className="rounded-md border border-border bg-muted/40">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
                {t("previewQuickstart")}
              </summary>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all px-3 pb-3 pt-1 font-mono text-[11px] leading-relaxed text-foreground/90">
                {quickStart}
              </pre>
            </details>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>{tCommon("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EndpointsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copied: boolean;
  onCopy: (value: string) => void;
}

function EndpointsDialog({ open, onOpenChange, copied, onCopy }: EndpointsDialogProps) {
  const t = useTranslations("apiKeys");
  const tCommon = useTranslations("common");

  const grouped = useMemo(() => {
    const map = new Map<string, EndpointEntry[]>();
    for (const e of ENDPOINTS) {
      const bucket = map.get(e.scope) ?? [];
      bucket.push(e);
      map.set(e.scope, bucket);
    }
    return Array.from(map.entries());
  }, []);

  const reference = useMemo(
    () =>
      renderQuickStart({
        scopes: ["*"],
        permissions: ["read", "write", "delete"],
      }),
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("endpointsDialogTitle")}</DialogTitle>
          <DialogDescription>{t("endpointsDialogDescription")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
          {grouped.map(([scope, entries]) => (
            <div key={scope}>
              <div className="mb-1.5 flex items-center gap-2">
                <Badge variant="info">{scope}</Badge>
              </div>
              <ul className="space-y-1.5">
                {entries.map((e) => (
                  <li
                    key={`${e.method} ${e.path}`}
                    className="rounded-md border border-border p-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold " +
                          (e.method === "GET"
                            ? "bg-success/15 text-success"
                            : e.method === "DELETE"
                              ? "bg-danger/15 text-danger"
                              : "bg-warning/15 text-warning")
                        }
                      >
                        {e.method}
                      </span>
                      <code className="break-all font-mono text-xs">{e.path}</code>
                      <Badge
                        variant={
                          e.permission === "delete"
                            ? "danger"
                            : e.permission === "write"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {e.permission}
                      </Badge>
                      {!e.cors && (
                        <Badge variant="neutral" title="No CORS — backend only">
                          no-cors
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{e.desc}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="secondary"
            onClick={() => onCopy(reference)}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {t("copyReference")}
            {copied ? " ✓" : ""}
          </Button>
          <Button onClick={() => onOpenChange(false)}>{tCommon("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
