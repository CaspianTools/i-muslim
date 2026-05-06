"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EditorDialog,
  EditorDialogBody,
  EditorDialogContent,
  EditorDialogDescription,
  EditorDialogFooter,
  EditorDialogHeader,
  EditorDialogTitle,
} from "@/components/ui/editor-dialog";
import { FormGrid } from "@/components/admin/ui/form-layout";
import type { AdminUser } from "@/types/admin";
import type { AdminRoleDoc } from "@/lib/admin/data/roles";

type Values = {
  name: string;
  email: string;
  role: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: AdminRoleDoc[];
  onInvite: (user: AdminUser) => void;
}

export function InviteUserDrawer({ open, onOpenChange, roles, onInvite }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations("users.invite");
  const tCommon = useTranslations("common");

  const roleIds = useMemo(() => roles.map((r) => r.id), [roles]);
  const defaultRole = roleIds.includes("member") ? "member" : (roleIds[0] ?? "member");

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, t("errorName")),
        email: z.string().email(t("errorEmail")),
        role: z.string().refine((v) => roleIds.includes(v), {
          message: "Unknown role",
        }),
      }),
    [t, roleIds],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", role: defaultRole },
  });

  async function onSubmit(values: Values) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite user");
      onInvite(data.user as AdminUser);
      reset({ name: "", email: "", role: defaultRole });
      onOpenChange(false);
    } catch (err) {
      const { toast } = await import("@/components/ui/sonner");
      toast.error(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EditorDialog open={open} onOpenChange={onOpenChange}>
      <EditorDialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
          <EditorDialogHeader>
            <EditorDialogTitle>{t("title")}</EditorDialogTitle>
            <EditorDialogDescription>{t("description")}</EditorDialogDescription>
          </EditorDialogHeader>
          <EditorDialogBody className="space-y-4">
            <FormGrid>
              <div className="space-y-1.5">
                <Label htmlFor="invite-name">{t("fullName")}</Label>
                <Input id="invite-name" autoComplete="name" {...register("name")} />
                {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">{t("emailLabel")}</Label>
                <Input id="invite-email" type="email" autoComplete="email" {...register("email")} />
                {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">{t("roleLabel")}</Label>
                <select
                  id="invite-role"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  {...register("role")}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </FormGrid>
          </EditorDialogBody>
          <EditorDialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? t("sending") : <><Send /> {t("send")}</>}
            </Button>
          </EditorDialogFooter>
        </form>
      </EditorDialogContent>
    </EditorDialog>
  );
}
